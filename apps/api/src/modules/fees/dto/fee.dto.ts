import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TermType } from '../entities/fee.entity';
import { PaymentType } from '../entities/fee-payment.entity';

const OFFLINE_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.CASH,
  PaymentType.CHEQUE,
  PaymentType.DD,
  PaymentType.NEFT,
];
const ONLINE_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.RAZORPAY,
  PaymentType.CASHFREE,
  PaymentType.UPI,
  PaymentType.NETBANKING,
  PaymentType.CARD,
];

/** Used internally by the upload flow. */
export interface CreateFeeInput {
  tenantId: string;
  branch: string;
  academicYear: string;
  studentId: string;
  term: TermType;
  originalAmount: number;
}

/** Used internally by the upload validator. */
export interface ExistingFeeRecord {
  admissionNumber: string;
  academicYear: string;
  term: TermType;
}

/**
 * POST /fees/penalty/add
 *
 * Two modes:
 *  - applyToAll=true  → apply to every non-PAID fee in (branch, year, term)
 *  - applyToAll=false → apply only to fees of the listed students (max 500)
 *
 * Branch and tenant are read from the JWT in the controller — not in the body.
 */
export class AddPenaltyDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, applies to every non-PAID fee in scope; admissionNumbers is ignored.',
  })
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Dummy1', 'Dummy2'],
    description: 'Required when applyToAll is false. Max 500 per call.',
  })
  @ValidateIf((o) => !o.applyToAll)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  admissionNumbers?: string[];

  @ApiProperty({ example: 100, description: 'Penalty amount in rupees.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'Late payment for 1st term' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/penalty/waive
 *
 * Same shape as AddPenaltyDto minus the `amount` field. Removes the full
 * current penalty on each affected fee.
 */
export class WaivePenaltyDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, waives every non-PAID fee with penalty > 0 in scope.',
  })
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Dummy1', 'Dummy2'],
    description: 'Required when applyToAll is false. Max 500 per call.',
  })
  @ValidateIf((o) => !o.applyToAll)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  admissionNumbers?: string[];

  @ApiPropertyOptional({ example: 'Scholarship students exempt' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/:id/discount
 * Adds a discount to a fee.
 */
export class AddDiscountDto {
  @ApiProperty({ example: 1000, description: 'Discount amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({ example: 'Scholarship award', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must be 500 characters or fewer' })
  reason?: string;
}

/**
 * POST /fees/:id/offline-payment
 * School staff records a cash / cheque / DD / NEFT payment.
 */
export class RecordOfflinePaymentDto {
  @ApiProperty({ example: 2500, description: 'Payment amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    enum: OFFLINE_PAYMENT_TYPES,
    description: 'One of the offline payment types',
  })
  @IsEnum(PaymentType, {
    message: `paymentType must be one of: ${OFFLINE_PAYMENT_TYPES.join(', ')}`,
  })
  paymentType: PaymentType;

  // Cheque details — required when paymentType = CHEQUE
  @ApiPropertyOptional({ example: '123456', description: 'Required when paymentType = CHEQUE' })
  @ValidateIf((o) => o.paymentType === PaymentType.CHEQUE)
  @IsString({ message: 'chequeNumber must be a string' })
  @IsNotEmpty({ message: 'chequeNumber is required when paymentType is CHEQUE' })
  @MaxLength(50, { message: 'chequeNumber must be 50 characters or fewer' })
  chequeNumber?: string;

  @ApiPropertyOptional({ example: '2026-04-23', description: 'Required when paymentType = CHEQUE' })
  @ValidateIf((o) => o.paymentType === PaymentType.CHEQUE)
  @IsISO8601({}, { message: 'chequeDate must be an ISO8601 date string (e.g. 2026-04-23)' })
  chequeDate?: string;

  // DD details — required when paymentType = DD
  @ApiPropertyOptional({ example: 'DD-00123', description: 'Required when paymentType = DD' })
  @ValidateIf((o) => o.paymentType === PaymentType.DD)
  @IsString({ message: 'ddNumber must be a string' })
  @IsNotEmpty({ message: 'ddNumber is required when paymentType is DD' })
  @MaxLength(50, { message: 'ddNumber must be 50 characters or fewer' })
  ddNumber?: string;

  @ApiPropertyOptional({ example: '2026-04-23', description: 'Required when paymentType = DD' })
  @ValidateIf((o) => o.paymentType === PaymentType.DD)
  @IsISO8601({}, { message: 'ddDate must be an ISO8601 date string (e.g. 2026-04-23)' })
  ddDate?: string;

  @ApiPropertyOptional({
    example: 'HDFC Bank',
    description: 'Required when paymentType is CHEQUE, DD, or NEFT',
  })
  @ValidateIf(
    (o) =>
      o.paymentType === PaymentType.CHEQUE ||
      o.paymentType === PaymentType.DD ||
      o.paymentType === PaymentType.NEFT,
  )
  @IsString({ message: 'bankName must be a string' })
  @IsNotEmpty({
    message: 'bankName is required when paymentType is CHEQUE, DD, or NEFT',
  })
  @MaxLength(100, { message: 'bankName must be 100 characters or fewer' })
  bankName?: string;

  /** Override the payment date. Defaults to now if omitted. */
  @ApiPropertyOptional({ example: '2026-04-23T10:15:30Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'paidAt must be an ISO8601 date-time string' })
  paidAt?: string;
}

/**
 * POST /fees/:id/online-payment (called by the payments team's webhook)
 * Records a successful online payment from Razorpay / Cashfree / etc.
 */
export class RecordOnlinePaymentDto {
  @ApiProperty({ example: 2500, description: 'Payment amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    enum: ONLINE_PAYMENT_TYPES,
    description: 'One of the online payment types',
  })
  @IsEnum(PaymentType, {
    message: `paymentType must be one of: ${ONLINE_PAYMENT_TYPES.join(', ')}`,
  })
  paymentType: PaymentType;

  @ApiProperty({ example: 'order_LXyz123', maxLength: 100 })
  @IsString({ message: 'orderId must be a string' })
  @IsNotEmpty({ message: 'orderId is required' })
  @MaxLength(100, { message: 'orderId must be 100 characters or fewer' })
  orderId: string;

  @ApiProperty({ example: 'pay_LXyz456', maxLength: 100 })
  @IsString({ message: 'transactionId must be a string' })
  @IsNotEmpty({ message: 'transactionId is required' })
  @MaxLength(100, { message: 'transactionId must be 100 characters or fewer' })
  transactionId: string;

  @ApiPropertyOptional({ example: '2026-04-23T10:15:30Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'paidAt must be an ISO8601 date-time string' })
  paidAt?: string;
}
