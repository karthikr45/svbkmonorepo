import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fee } from './entities/fee.entity';
import { FeePayment } from './entities/fee-payment.entity';
import { FeeAdjustment } from './entities/fee-adjustment.entity';
import { FeesService } from './fees.service';
import { StudentFeesService } from './student-fees.service';
import { FeesController } from './fees.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Fee, FeePayment, FeeAdjustment])],
  controllers: [FeesController],
  providers: [FeesService, StudentFeesService],
  exports: [FeesService, StudentFeesService],
})
export class FeesModule {}