import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { Student } from './entities/student.entity';
import { FeesModule } from '../fees/fees.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UploadService } from './upload.service';
import { UploadValidationService } from './upload-validation.service';
import { StudentsDetailsController } from './students-details.controller';

/**
 * One-way dependency: students → fees.
 *
 * Students module depends on fees because:
 *  - The Excel upload creates students AND fees (calls FeesService.bulkCreate)
 *  - The student profile page shows fees + payments (calls StudentFeesService)
 *
 * Fees module does NOT import students — it only works with IDs and
 * the database join via TypeORM relations. This keeps dependencies clean.
 *
 * Also depends on tenants to read the per-tenant admission-number pattern.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Student]), FeesModule, TenantsModule],
  controllers: [StudentsController, StudentsDetailsController],
  providers: [StudentsService, UploadService, UploadValidationService],
  exports: [StudentsService],
})
export class StudentsModule {}