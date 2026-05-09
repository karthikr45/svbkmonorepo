import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('fee-collection')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getFeeCollection(@CurrentUser() _user: any, @Query() _filters: any) {
    // TODO: implement
  }

  @Get('outstanding-fees')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getOutstandingFees(@CurrentUser() _user: any, @Query() _filters: any) {
    // TODO: implement
  }

  @Get('payment-summary')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getPaymentSummary(@CurrentUser() _user: any, @Query() _filters: any) {
    // TODO: implement
  }

  @Post('export')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  exportReport(@CurrentUser() _user: any, @Body() _body: any) {
    // TODO: implement
  }
}
