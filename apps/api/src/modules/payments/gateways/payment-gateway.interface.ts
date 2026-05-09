export interface OrderNotes {
  admission: string;
  academicYear: string;
  term: string;
  studentName: string;
  email: string;
}

export interface GatewayOrderResult {
  gatewayOrderId: string;
  amount: number;
  currency: string;
  raw: Record<string, any>;
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;        // Razorpay: razorpay_signature | Cashfree: not used (fetches status)
}

export interface VerifyPaymentResult {
  success: boolean;
  gatewayPaymentId: string;
}

export interface IPaymentGateway {
  createOrder(amount: number, currency: string, notes: OrderNotes): Promise<GatewayOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}
