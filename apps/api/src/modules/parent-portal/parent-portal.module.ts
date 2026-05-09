import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { ParentsModule } from '../parents/parents.module';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalController } from './parent-portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Fee, Payment, ParentStudent]),
    ParentsModule,
    AcademicYearsModule,
  ],
  providers: [ParentPortalService],
  controllers: [ParentPortalController],
})
export class ParentPortalModule {}
