import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RazorpayWebhookDto, CashfreeWebhookDto } from '../dto/webhook.dto';

@Injectable()
export class WebhookVerificationService {
  private readonly logger = new Logger(WebhookVerificationService.name);

  constructor(private readonly configService: ConfigService) {}

  verifyRazorpayWebhook(payload: Record<string, any>, signature: string): boolean {
    try {
      const keySecret = this.configService.get<string>('razorpay.keySecret');
      if (!keySecret) throw new Error('Razorpay keySecret not configured');

      // Razorpay: HMAC-SHA256(JSON.stringify(payload), keySecret)
      const body = JSON.stringify(payload);
      const expectedSignature = createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        this.logger.warn(`Razorpay signature verification failed. Expected: ${expectedSignature}, Got: ${signature}`);
      }

      return isValid;
    } catch (err) {
      this.logger.error('Razorpay webhook verification error', err);
      throw new BadRequestException('Razorpay webhook verification failed');
    }
  }

  verifyCashfreeWebhook(rawBody: string, signature: string, timestamp: string): boolean {
    try {
      const secretKey = this.configService.get<string>('cashfree.secretKey');
      if (!secretKey) throw new Error('Cashfree secretKey not configured');

      // Cashfree: Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
      const expectedSignature = createHmac('sha256', secretKey)
        .update(timestamp + rawBody)
        .digest('base64');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        this.logger.warn(`Cashfree signature verification failed. Expected: ${expectedSignature}, Got: ${signature}`);
      }

      return isValid;
    } catch (err) {
      this.logger.error('Cashfree webhook verification error', err);
      throw new BadRequestException('Cashfree webhook verification failed');
    }
  }
}
