import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class PublicInitiateDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsString()
  @IsNotEmpty()
  feeId: string;
}

export class PublicVerifyDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsString()
  @IsNotEmpty()
  gatewayOrderId: string;

  // Cashfree's modal flow only returns the order id — we fetch the
  // payment id and verify against the gateway server-side. Razorpay's
  // handler callback supplies both.
  @IsOptional()
  @IsString()
  gatewayPaymentId?: string;

  @IsOptional()
  @IsString()
  signature?: string;
}
