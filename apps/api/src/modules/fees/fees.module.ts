import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fee } from './entities/fee.entity';
import { FeePayment } from './entities/fee-payment.entity';
import { FeesService } from './fees.service';
import { StudentFeesService } from './student-fees.service';
import { FeesController } from './fees.controller';

/**
 * Fees module has no cross-module dependencies. It exports FeesService
 * (for the upload flow in students module to use) and StudentFeesService
 * (for the student profile page in students module).
 *
 * The Fee entity has a `@ManyToOne(() => Student)` relation — that's
 * just a TypeORM foreign key, it doesn't create a module-level
 * import dependency.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Fee, FeePayment])],
  controllers: [FeesController],
  providers: [FeesService, StudentFeesService],
  exports: [FeesService, StudentFeesService],
})
export class FeesModule {}