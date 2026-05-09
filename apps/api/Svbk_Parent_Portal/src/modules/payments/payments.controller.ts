import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeesService } from '../fees/fees.service';
import { StudentsService } from '../students/students.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly feesService: FeesService,
    private readonly studentsService: StudentsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Make a payment (full or partial)',
    description: 'Pay the full or part of a fee record. Amount must not exceed remaining due.',
  })
  async createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: any) {
    const feeRecord = await this.feesService.findById(dto.feeRecordId);
    if (!feeRecord) throw new NotFoundException('Fee record not found');

    const student = await this.studentsService.findById(feeRecord.studentId);
    if (!student || student.parentId !== user.parentId) {
      throw new ForbiddenException('Access denied');
    }

    return this.paymentsService.createPayment(dto, user.parentId);
  }

  @Get('fee/:feeRecordId')
  @ApiOperation({ summary: 'Get payment history for a fee record' })
  async getPaymentHistory(
    @Param('feeRecordId', ParseUUIDPipe) feeRecordId: string,
    @CurrentUser() user: any,
  ) {
    const feeRecord = await this.feesService.findById(feeRecordId);
    if (!feeRecord) throw new NotFoundException('Fee record not found');

    const student = await this.studentsService.findById(feeRecord.studentId);
    if (!student || student.parentId !== user.parentId) {
      throw new ForbiddenException('Access denied');
    }

    const payments = await this.paymentsService.getPaymentsByFeeRecord(feeRecordId);
    return payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      transactionId: p.transactionId,
      createdAt: p.createdAt,
    }));
  }
}
