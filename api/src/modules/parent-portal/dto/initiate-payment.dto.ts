import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { PaymentGateway } from '../../payments/entities/payment.entity';

export class ParentInitiatePaymentDto {
  @ApiProperty({ description: 'Fee record to pay against' })
  @IsUUID()
  @IsNotEmpty()
  feeId: string;

  @ApiProperty({ enum: PaymentGateway, example: PaymentGateway.RAZORPAY })
  @IsEnum(PaymentGateway)
  gateway: PaymentGateway;
}
