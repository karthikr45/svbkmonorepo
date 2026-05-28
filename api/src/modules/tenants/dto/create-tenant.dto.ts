import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptResetPolicy } from '../entities/tenant.entity';

export class CreateTenantDto {
  @ApiProperty({ example: 'Sunrise High School' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'SHS001' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 'TNT001' })
  @IsString()
  @IsNotEmpty()
  tenantCode: string;

  @ApiProperty({ example: 'Sunrise Tenant' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional({ example: 'CBSE' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    example: 'term_wise',
    description:
      'Billing mode (a billing_mode metadata value: term_wise | monthly). ' +
      'When omitted, derived from type — transport is monthly, others term-wise.',
  })
  @IsString()
  @IsOptional()
  billingMode?: string;

  @ApiPropertyOptional({ example: 'State Board' })
  @IsString()
  @IsOptional()
  boardType?: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Hyderabad' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Telangana' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    example: 'SVBK',
    description:
      'Short prefix shown on every receipt issued for this tenant ' +
      '(letters / digits only). Defaults to the tenant code if omitted.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  receiptPrefix?: string;

  @ApiPropertyOptional({
    enum: ReceiptResetPolicy,
    example: ReceiptResetPolicy.ACADEMIC_YEAR,
    description:
      'How often the receipt sequence rolls back to the start number. ' +
      'Default is ACADEMIC_YEAR (most Indian schools).',
  })
  @IsEnum(ReceiptResetPolicy)
  @IsOptional()
  receiptResetPolicy?: ReceiptResetPolicy;

  @ApiPropertyOptional({
    example: 1,
    description: 'First receipt number to issue in any fresh period.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  receiptStartNumber?: number;
}
