import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptResetPolicy } from '../entities/tenant.entity';

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  boardType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Short prefix shown on receipts.' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  receiptPrefix?: string;

  @ApiPropertyOptional({ enum: ReceiptResetPolicy })
  @IsEnum(ReceiptResetPolicy)
  @IsOptional()
  receiptResetPolicy?: ReceiptResetPolicy;

  @ApiPropertyOptional({ description: 'First number issued in any fresh period.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  receiptStartNumber?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
