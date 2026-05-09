import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { WebhookGatewayDetectorService, PaymentWebhookGateway } from './webhook-gateway-detector.service';
import { WebhookVerificationService } from './webhook-verification.service';
import { WebhookHandlerService } from './webhook-handler.service';
import { RazorpayWebhookDto, CashfreeWebhookDto } from '../dto/webhook.dto';
import { PaymentAuditService } from '../payment-audit.service';
import { AuditAction } from '../entities/payment-audit-log.entity';

@Injectable()
export class UnifiedWebhookService {
  private readonly logger = new Logger(UnifiedWebhookService.name);

  constructor(
    private readonly detectorService: WebhookGatewayDetectorService,
    private readonly verificationService: WebhookVerificationService,
    private readonly handlerService: WebhookHandlerService,
    private readonly auditService: PaymentAuditService,
  ) {}

  async handleUnifiedWebhook(
    headers: Record<string, string>,
    payload: Record<string, any>,
    rawBody: string,
  ) {
    try {
      const { gateway, signatureHeader } = this.detectorService.detectGateway(headers, payload);

      if (gateway === PaymentWebhookGateway.UNKNOWN) {
        void this.auditService.log({
          tenantId: 'unknown',
          action: AuditAction.WEBHOOK_GATEWAY_UNKNOWN,
          actor: 'webhook',
          isError: true,
          errorMessage: 'Could not detect payment gateway from webhook',
          metadata: { rawWebhookPayload: payload, headers },
        });
        throw new BadRequestException('Could not detect payment gateway from webhook');
      }

      this.logger.log(`Processing ${gateway} webhook`);

      const isValid = this.verifyWebhookSignature(gateway, payload, rawBody, headers, signatureHeader);

      if (!isValid) {
        this.logger.warn(`Invalid signature for ${gateway} webhook`);
        throw new BadRequestException(`Invalid webhook signature for ${gateway}`);
      }

      const result = await this.routeToGatewayHandler(gateway, payload);

      return {
        success: true,
        gateway,
        message: `${gateway} webhook processed successfully`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error processing unified webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  private verifyWebhookSignature(
    gateway: PaymentWebhookGateway,
    payload: Record<string, any>,
    rawBody: string,
    headers: Record<string, string>,
    signature: string | null,
  ): boolean {
    if (!signature) {
      throw new BadRequestException(`Missing signature header for ${gateway}`);
    }

    switch (gateway) {
      case PaymentWebhookGateway.RAZORPAY:
        return this.verificationService.verifyRazorpayWebhook(payload, signature);

      case PaymentWebhookGateway.CASHFREE: {
        const timestamp = headers['x-webhook-timestamp'] ?? '';
        return this.verificationService.verifyCashfreeWebhook(rawBody, signature, timestamp);
      }

      default:
        throw new BadRequestException(`Unsupported gateway: ${gateway}`);
    }
  }

  private async routeToGatewayHandler(
    gateway: PaymentWebhookGateway,
    payload: Record<string, any>,
  ) {
    switch (gateway) {
      case PaymentWebhookGateway.RAZORPAY:
        return this.handleRazorpayWebhook(payload);

      case PaymentWebhookGateway.CASHFREE:
        return this.handleCashfreeWebhook(payload);

      default:
        throw new BadRequestException(`No handler for gateway: ${gateway}`);
    }
  }

  private async handleRazorpayWebhook(payload: Record<string, any>) {
    const dto: RazorpayWebhookDto = {
      event: payload.event,
      payload: payload.payload,
    };

    try {
      const result = await this.handlerService.handleRazorpayWebhook(dto);
      this.logger.log(`Razorpay webhook handled successfully for payment ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error handling Razorpay webhook: ${error.message}`);
      throw error;
    }
  }

  private async handleCashfreeWebhook(payload: Record<string, any>) {
    const dto: CashfreeWebhookDto = {
      eventType: payload.type ?? payload.eventType,
      eventTime: payload.event_time ?? payload.eventTime,
      data: payload.data,
    };

    try {
      const result = await this.handlerService.handleCashfreeWebhook(dto);
      this.logger.log(`Cashfree webhook handled successfully for payment ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error handling Cashfree webhook: ${error.message}`);
      throw error;
    }
  }
}
