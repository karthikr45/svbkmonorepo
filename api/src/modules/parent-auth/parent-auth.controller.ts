import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParentAuthService } from './parent-auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ParentRefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('parent-auth')
@Controller('parent/auth')
export class ParentAuthController {
  constructor(private readonly parentAuthService: ParentAuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a 6-digit OTP to a parent email' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.parentAuthService.sendOtp(dto.email, dto.tenantCode);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive access + refresh tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.parentAuthService.verifyOtp(dto.email, dto.otp, dto.tenantCode);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token, issue new pair' })
  refresh(@Body() dto: ParentRefreshTokenDto) {
    return this.parentAuthService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@CurrentUser() user: any) {
    await this.parentAuthService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }
}
