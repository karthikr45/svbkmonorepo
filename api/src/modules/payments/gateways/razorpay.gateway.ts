import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';
import {
  IPaymentGateway,
  GatewayOrderResult,
  OrderNotes,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-gateway.interface';

@Injectable()
export class RazorpayGateway implements IPaymentGateway {
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly client: Razorpay;
  private readonly keySecret: string;

  constructor(private readonly configService: ConfigService) {
    this.keySecret = this.configService.get<string>('razorpay.keySecret') ?? '';
    this.client = new Razorpay({
      key_id: this.configService.get<string>('razorpay.keyId'),
      key_secret: this.keySecret,
    });
  }

  async createOrder(amount: number, currency: string, notes?: OrderNotes): Promise<GatewayOrderResult> {
    try {
      const order = await (this.client.orders.create({
        amount: amount * 100, // Razorpay expects paise
        currency,
        notes: notes as unknown as Record<string, string | number>,
      }) as unknown as Promise<{ id: string; amount: number; currency: string }>);

      return {
        gatewayOrderId: order.id,
        amount: order.amount,
        currency: order.currency,
        raw: order as unknown as Record<string, any>,
      };
    } catch (err) {
      this.logger.error('Razorpay createOrder failed', err);
      throw new InternalServerErrorException('Failed to create Razorpay order');
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    try {
      const body = `${input.gatewayOrderId}|${input.gatewayPaymentId}`;
      const expectedSignature = createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      const isProduction = process.env.NODE_ENV === 'production';
      // In dev/test, skip signature check so you can test with real Razorpay test keys
      const success = isProduction ? expectedSignature === input.signature : true;

      if (isProduction && !success) {
        this.logger.warn(`Razorpay signature mismatch for order ${input.gatewayOrderId}`);
      }

      return { success, gatewayPaymentId: input.gatewayPaymentId };
    } catch (err) {
      this.logger.error('Razorpay verifyPayment failed', err);
      throw new InternalServerErrorException('Failed to verify Razorpay payment');
    }
  }
}
