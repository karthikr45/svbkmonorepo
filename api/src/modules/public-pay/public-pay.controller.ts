import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicPayService } from './public-pay.service';
import { PublicInitiateDto, PublicVerifyDto } from './dto/public-pay.dto';

/**
 * Login-free fee payment surface. Tenant is resolved from the `host`
 * query/body parameter (the frontend reads window.location.host and
 * forwards it) against tenant_configurations.domain_url. All endpoints
 * are intentionally narrow: only enough to render the form, list a
 * student's open fees, and complete a Razorpay/Cashfree checkout.
 *
 * Throttled aggressively to make admission-number enumeration painful.
 */
@ApiTags('public-pay')
@Controller('public-pay')
export class PublicPayController {
  constructor(private readonly service: PublicPayService) {}

  @Get('tenant')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Resolve the tenant for the current host — used by the page chrome',
  })
  tenant(@Query('host') host: string) {
    return this.service.resolveTenant(host);
  }

  @Get('fees')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'List fees for an admission number + academic year' })
  fees(
    @Query('host') host: string,
    @Query('admissionNumber') admissionNumber: string,
    @Query('academicYear') academicYear: string,
  ) {
    return this.service.listFees(host, admissionNumber, academicYear);
  }

  @Post('initiate')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Start a public payment for one fee' })
  initiate(@Body() dto: PublicInitiateDto) {
    return this.service.initiate(dto);
  }

  @Post('verify')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Confirm a public payment after the gateway closes' })
  verify(@Body() dto: PublicVerifyDto) {
    return this.service.verify(dto);
  }
}
