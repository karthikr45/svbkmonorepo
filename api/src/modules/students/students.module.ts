import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { Student } from './entities/student.entity';
import { FeesModule } from '../fees/fees.module';
import { UploadService } from './upload.service';
import { UploadValidationService } from './upload-validation.service';
import { StudentsDetailsController } from './students-details.controller';
import { StudentIdentitiesModule } from '../student-identities/student-identities.module';

/**
 * Dependencies: students → fees, students → student-identities.
 *
 * Students depends on fees because the bulk-upload flow creates fees
 * alongside students; on identities because every new enrollment must
 * be attached to a canonical person identity.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Student]),
    FeesModule,
    StudentIdentitiesModule,
  ],
  controllers: [StudentsController, StudentsDetailsController],
  providers: [StudentsService, UploadService, UploadValidationService],
  exports: [StudentsService],
})
export class StudentsModule {}