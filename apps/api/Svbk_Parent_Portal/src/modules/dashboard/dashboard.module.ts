import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { StudentsModule } from '../students/students.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [StudentsModule, FeesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
