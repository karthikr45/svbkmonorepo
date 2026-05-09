import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import {
  IPaymentGateway,
  GatewayOrderResult,
  OrderNotes,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-gateway.interface';

@Injectable()
export class CashfreeGateway implements IPaymentGateway {
  private readonly logger = new Logger(CashfreeGateway.name);
  private readonly client: Cashfree;

  constructor(private readonly configService: ConfigService) {
    const env = process.env.NODE_ENV === 'production'
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

    this.client = new Cashfree(
      env,
      this.configService.get<string>('cashfree.appId'),
      this.configService.get<string>('cashfree.secretKey'),
    );
  }

  async createOrder(amount: number, currency: string, notes?: OrderNotes): Promise<GatewayOrderResult> {
    try {
      const orderId = `order_${Date.now()}`;
      const orderNote = notes
        ? `${notes.studentName} | ${notes.admission} | ${notes.term} | ${notes.academicYear}`
        : undefined;

      const response = await this.client.PGCreateOrder({
        order_id: orderId,
        order_amount: amount, // Cashfree expects rupees directly
        order_currency: currency,
        order_note: orderNote,
        customer_details: {
          customer_id: 'guest',
          customer_phone: '9999999999',
        },
      });

      const order = response.data;
      const gatewayOrderId = order.order_id ?? orderId;

      return {
        gatewayOrderId,
        amount,
        currency,
        raw: order as unknown as Record<string, any>,
      };
    } catch (err) {
      this.logger.error('Cashfree createOrder failed', err?.response?.data ?? err);
      throw new InternalServerErrorException('Failed to create Cashfree order');
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    try {
      // Step 1: confirm order is PAID
      const orderResponse = await this.client.PGFetchOrder(input.gatewayOrderId);
      const order = orderResponse.data;
      const success = order.order_status === 'PAID';

      if (!success) {
        this.logger.warn(`Cashfree order ${input.gatewayOrderId} status: ${order.order_status}`);
        return { success: false, gatewayPaymentId: input.gatewayPaymentId };
      }

      // Step 2: fetch actual cf_payment_id from payments list
      const paymentsResponse = await this.client.PGOrderFetchPayments(input.gatewayOrderId);
      const payments = paymentsResponse.data;
      const successfulPayment = payments.find((p) => p.payment_status === 'SUCCESS');
      const gatewayPaymentId = successfulPayment?.cf_payment_id ?? input.gatewayPaymentId;

      return { success: true, gatewayPaymentId };
    } catch (err) {
      this.logger.error('Cashfree verifyPayment failed', err?.response?.data ?? err);
      throw new InternalServerErrorException('Failed to verify Cashfree payment');
    }
  }
}
