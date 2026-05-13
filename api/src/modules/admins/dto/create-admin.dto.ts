import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../../common/enums/roles.enum';

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

  @ApiProperty({ enum: Role, example: Role.ADMIN })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 'Main Branch' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({
    example: 'Welcome@123',
    description: 'Initial password. Defaults to system default if omitted.',
  })
  @IsString()
  @IsOptional()
  password?: string;
}
