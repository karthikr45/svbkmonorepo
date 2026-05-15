import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fee } from './entities/fee.entity';
import { FeePayment } from './entities/fee-payment.entity';
import { FeeAdjustment } from './entities/fee-adjustment.entity';
import { ReceiptSequence } from './entities/receipt-sequence.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { FeesService } from './fees.service';
import { StudentFeesService } from './student-fees.service';
import { FeesController } from './fees.controller';
import { ReceiptTemplatesModule } from '../receipt-templates/receipt-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fee, FeePayment, FeeAdjustment, ReceiptSequence, Tenant]),
    ReceiptTemplatesModule,
  ],
  controllers: [FeesController],
  providers: [FeesService, StudentFeesService],
  exports: [FeesService, StudentFeesService],
})
export class FeesModule {}