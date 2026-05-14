import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
}
