import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import {
  IPaymentGateway,
  GatewayCredentials,
  GatewayOrderResult,
  OrderNotes,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-gateway.interface';

/**
 * Stateless wrapper around the Cashfree SDK. Credentials are passed
 * per call so a single instance can serve every tenant.
 */
@Injectable()
export class CashfreeGateway implements IPaymentGateway {
  private readonly logger = new Logger(CashfreeGateway.name);

  /**
   * Sandbox vs production for Cashfree. Driven by CASHFREE_MODE env
   * (explicit override) or NODE_ENV. Exposed via a static helper so
   * the controller layer can echo the same value back to the frontend
   * — the JS SDK's mode must match the order's environment, or it
   * rejects payment_session_id as invalid.
   */
  static currentMode(): 'sandbox' | 'production' {
    const explicit = (process.env.CASHFREE_MODE ?? '').toLowerCase();
    if (explicit === 'production' || explicit === 'sandbox') return explicit;
    return process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
  }

  private buildClient(creds: GatewayCredentials): Cashfree {
    if (!creds.clientId || !creds.secretKey) {
      throw new InternalServerErrorException(
        'Cashfree credentials are not configured for this tenant. ' +
          'Add them under the tenant\'s Configuration tab.',
      );
    }
    const env =
      CashfreeGateway.currentMode() === 'production'
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX;
    return new Cashfree(env, creds.clientId, creds.secretKey);
  }

  async createOrder(
    creds: GatewayCredentials,
    amount: number,
    currency: string,
    notes?: OrderNotes,
  ): Promise<GatewayOrderResult> {
    try {
      const client = this.buildClient(creds);
      const orderId = `order_${Date.now()}`;
      const orderNote = notes
        ? `${notes.studentName} | ${notes.admission} | ${notes.term} | ${notes.academicYear}`
        : undefined;

      const response = await client.PGCreateOrder({
        order_id: orderId,
        order_amount: amount,
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

  async verifyPayment(
    creds: GatewayCredentials,
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    try {
      const client = this.buildClient(creds);
      const orderResponse = await client.PGFetchOrder(input.gatewayOrderId);
      const order = orderResponse.data;
      const success = order.order_status === 'PAID';

      if (!success) {
        this.logger.warn(
          `Cashfree order ${input.gatewayOrderId} status: ${order.order_status}`,
        );
        return { success: false, gatewayPaymentId: input.gatewayPaymentId };
      }

      const paymentsResponse = await client.PGOrderFetchPayments(
        input.gatewayOrderId,
      );
      const payments = paymentsResponse.data;
      const successfulPayment = payments.find(
        (p: any) => p.payment_status === 'SUCCESS',
      );
      const gatewayPaymentId =
        successfulPayment?.cf_payment_id ?? input.gatewayPaymentId;

      return { success: true, gatewayPaymentId };
    } catch (err) {
      this.logger.error('Cashfree verifyPayment failed', err?.response?.data ?? err);
      throw new InternalServerErrorException('Failed to verify Cashfree payment');
    }
  }
}
