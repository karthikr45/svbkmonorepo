import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FeesService } from './fees.service';
import {
  AddPenaltyDto,
  AddDiscountDto,
  RecordOfflinePaymentDto,
  RecordOnlinePaymentDto,
  WaivePenaltyDto,
} from './dto/fee.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('fees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get fee amount stats',
    description:
      'Returns the sum of originalAmount across all fee rows for the tenant, plus month-over-month percentage change so the UI can display an increase/decrease indicator.',
  })
  async getFeeStats(@Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.feesService.getFeeStats(tenantId);
  }

 @Post('penalty/add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add penalty (single, multiple, or all students)',
    description:
      'Applies a penalty to fees in the current branch+year+term. Use admissionNumbers for selective application (max 500). Use applyToAll=true to apply to every non-PAID fee in scope. PAID fees are silently skipped. Branch is taken from JWT.',
  })
  async addPenalty(@Body() dto: AddPenaltyDto, @Req() req: Request) {
    const { tenantId, branch } = ctxWithBranch(req);
    return this.feesService.addPenaltyForStudents(tenantId, { ...dto, branch });
  }

  @Post('penalty/waive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Waive penalty (single, multiple, or all students)',
    description:
      'Removes the full current penalty from fees in the current branch. Use admissionNumbers for selective waiver (max 500). Use applyToAll=true to waive for every non-PAID fee with penalty > 0. PAID fees and fees with no penalty are silently skipped. Branch is taken from JWT.',
  })
  async waivePenalty(@Body() dto: WaivePenaltyDto, @Req() req: Request) {
    const { tenantId, branch } = ctxWithBranch(req);
    return this.feesService.waivePenaltyForStudents(tenantId, { ...dto, branch });
  }

  @Post(':id/discount')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add discount to a fee',
    description:
      'Adds to total_discount and recomputes net_amount. Rejected if it would drop net_amount below what has already been paid.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async addDiscount(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: AddDiscountDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.addDiscount(tenantId, feeId, dto.amount, dto.reason);
  }

  @Post(':id/offline-payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an offline payment',
    description:
      'School staff records a cash, cheque, DD, or NEFT payment. Amount cannot exceed remaining balance. Part payments supported.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async recordOfflinePayment(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: RecordOfflinePaymentDto,
    @Req() req: Request,
  ) {
    const { tenantId, userId } = ctx(req);
    return this.feesService.recordOfflinePayment(tenantId, feeId, {
      amount: dto.amount,
      paymentType: dto.paymentType,
      chequeNumber: dto.chequeNumber,
      chequeDate: dto.chequeDate,
      ddNumber: dto.ddNumber,
      ddDate: dto.ddDate,
      bankName: dto.bankName,
      paidAt: dto.paidAt,
      recordedBy: userId,
    });
  }

  @Post(':id/online-payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an online payment (called by webhook handler)',
    description:
      'Called by the payments team after a gateway payment succeeds. Accepts orderId + transactionId from the gateway.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async recordOnlinePayment(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: RecordOnlinePaymentDto,
    @Req() req: Request,
  ) {
    const { tenantId, userId } = ctx(req);
    return this.feesService.recordOnlinePayment(tenantId, feeId, {
      amount: dto.amount,
      paymentType: dto.paymentType,
      orderId: dto.orderId,
      transactionId: dto.transactionId,
      paidAt: dto.paidAt,
      recordedBy: userId,
    });
  }
}

// ─────────────── helpers ───────────────

interface AuthContext {
  tenantId: string;
  userId: string;
  branch: string | null;
}

function ctx(req: Request): AuthContext {
  const user = (req as any).user;
  if (!user?.tenantId || !user?.userId) {
    throw new UnauthorizedException('Authentication required');
  }
  return {
    tenantId: user.tenantId,
    userId: user.userId,
    branch: user.branch ?? null,
  };
}

/** Variant that requires the user's JWT to carry a branch. Throws 403 otherwise. */
function ctxWithBranch(req: Request): AuthContext & { branch: string } {
  const c = ctx(req);
  if (!c.branch) {
    throw new ForbiddenException(
      'Your account is not scoped to a branch — this endpoint requires a branch-scoped token.',
    );
  }
  return { ...c, branch: c.branch };
}
function buildUuidPipe(paramName: string) {
  return new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new BadRequestException(`${paramName} must be a valid UUID`),
  });
}
