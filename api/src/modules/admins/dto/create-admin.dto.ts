import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ example: 'TNT001' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ example: 'john.doe@school.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'admin',
    description:
      'Role identifier. Built-ins: super_admin / admin / fin_admin / ops_admin. ' +
      'Custom roles can be defined by super-admin via system_metadata(type=admin_role).',
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ example: 'Main Branch' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({
    example: 'Welcome@123',
    description: 'Initial password. Defaults to system default if omitted.',
  })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
