import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsModule } from '../students/students.module';
import { FeesController } from './fees.controller';
import { FeeRecord } from './entities/fee-record.entity';
import { FeesService } from './fees.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeeRecord]), StudentsModule],
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
