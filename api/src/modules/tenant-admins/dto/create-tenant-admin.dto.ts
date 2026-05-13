import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/enums/roles.enum';

export class CreateTenantAdminDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jane.doe@school.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: Role,
    example: Role.FIN_ADMIN,
    description:
      'Role to assign. Only ADMIN, FIN_ADMIN, OPS_ADMIN are accepted from this endpoint.',
  })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 'Main Branch' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({
    example: 'Welcome@123',
    description:
      'Initial password. If omitted, the system default seed password is used.',
  })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
