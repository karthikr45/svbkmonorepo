import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { PaymentGateway } from '../../payments/entities/payment.entity';

export class ParentInitiatePaymentDto {
  @ApiPropertyOptional({ description: 'Fee record to pay against' })
  @IsUUID()
  @IsNotEmpty()
  feeId: string;

  // Optional and normally omitted — the server picks the gateway from the
  // tenant's active configuration. Kept only as an override for testing.
  @ApiPropertyOptional({ enum: PaymentGateway })
  @IsOptional()
  @IsEnum(PaymentGateway)
  gateway?: PaymentGateway;
}
