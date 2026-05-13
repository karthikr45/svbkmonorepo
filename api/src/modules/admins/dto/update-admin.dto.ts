import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'Main Branch' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({ example: 'NewPass@123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
