import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptTemplate } from './entities/receipt-template.entity';
import { ReceiptTemplatesService } from './receipt-templates.service';
import { ReceiptTemplatesController } from './receipt-templates.controller';
import { Fee } from '../fees/entities/fee.entity';
import { FeePayment } from '../fees/entities/fee-payment.entity';
import { Student } from '../students/entities/student.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReceiptTemplate,
      Fee,
      FeePayment,
      Student,
      Tenant,
    ]),
  ],
  controllers: [ReceiptTemplatesController],
  providers: [ReceiptTemplatesService],
  exports: [ReceiptTemplatesService],
})
export class ReceiptTemplatesModule {}
