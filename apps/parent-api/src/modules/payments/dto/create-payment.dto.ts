import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'fee-record-uuid', description: 'UUID of the fee record to pay' })
  @IsUUID()
  @IsNotEmpty()
  feeRecordId: string;

  @ApiProperty({ example: 5000, description: 'Amount to pay (partial or full)' })
  @IsNumber()
  @IsPositive()
  amount: number;
}
