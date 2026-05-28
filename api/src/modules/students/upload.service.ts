import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { parseExcel } from './utils/excel-parser.util';
import { UploadValidationService } from './upload-validation.service';
import { StudentsService } from './students.service';
import { FeesService } from '../fees/fees.service';
import { StudentIdentitiesService } from '../student-identities/student-identities.service';
import { ParentsService } from '../parents/parents.service';
import {
  ValidateUploadResponseDto,
  ConfirmUploadResponseDto,
} from './dto/upload.dto';
import { NormalisedRow } from './utils/row-validator.util';
import { UpsertStudentInput } from './dto/student.dto';
import { CreateFeeInput } from '../fees/dto/fee.dto';
import { Student, StudentType } from './entities/student.entity';

/**
 * Orchestrates the Excel upload:
 *   parse → validate → (on confirm) persist atomically.
 *
 * Lives in the students module because the Excel primarily creates
 * student records (and creates fees as a byproduct). Delegates to:
 *   - StudentsService.bulkUpsert for the students side
 *   - FeesService.bulkCreate for the fees side
 * inside one shared transaction so either everything commits or
 * nothing does.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly validationService: UploadValidationService,
    private readonly studentsService: StudentsService,
    private readonly feesService: FeesService,
    private readonly identitiesService: StudentIdentitiesService,
    private readonly parentsService: ParentsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Step 1: parse + validate. No writes. */
  async validateFile(
    buffer: Buffer,
    tenantId: string,
    branch: string,
  ): Promise<ValidateUploadResponseDto> {
    const parsed = parseExcel(buffer);
    this.logger.log(
      `Validating ${parsed.rows.length} rows (tenant=${tenantId}, branch=${branch})`,
    );
    const { response } = await this.validationService.validate(
      parsed.rows,
      tenantId,
      branch,
    );
    return response;
  }

  /**
   * Step 2: re-parse, re-validate, persist atomically.
   *
   * The file is re-uploaded rather than trusting the client to echo
   * validated rows back. Keeps the backend stateless and prevents
   * tampering between validate and confirm.
   */
  async confirmUpload(
    buffer: Buffer,
    tenantId: string,
    branch: string,
  ): Promise<ConfirmUploadResponseDto> {
    const parsed = parseExcel(buffer);
    const { response, validRows } = await this.validationService.validate(
      parsed.rows,
      tenantId,
      branch,
    );

    if (response.errorCount > 0) {
      throw new BadRequestException({
        message:
          'Upload contains invalid rows. Fix them in the Excel and re-upload.',
        errorCount: response.errorCount,
        totalRows: response.totalRows,
        errors: response.rows.filter((r) => r.status === 'ERROR'),
      });
    }

    return this.persist(validRows, tenantId, branch);
  }

  private async persist(
    rows: NormalisedRow[],
    tenantId: string,
    branch: string,
  ): Promise<ConfirmUploadResponseDto> {
    if (!rows.length) {
      return {
        message: 'Nothing to persist',
        studentsCreated: 0,
        studentsUpdated: 0,
        feesCreated: 0,
      };
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Deduplicate students — one Excel row can produce multiple
        // NormalisedRows (one per term) but the student only needs to
        // be upserted once.
        const studentByKey = new Map<string, UpsertStudentInput>();
        for (const r of rows) {
          // Per-row branch code (the validator already enforced it equals
          // the JWT branch when one is set).
          const rowBranchCode = r.branchCode || branch;
          const key = `${rowBranchCode}::${r.admissionNumber}::${r.academicYear}`;
          if (!studentByKey.has(key)) {
            studentByKey.set(key, {
              tenantId,
              branchCode: rowBranchCode,
              type: r.type,
              admissionNumber: r.admissionNumber,
              academicYear: r.academicYear,
              name: r.name,
              email: r.email,
              phoneNumber: r.phoneNumber,
              class: r.class,
              section: r.section,
              rollNo: r.rollNo,
              imgUrl: r.imgUrl,
            });
          }
        }
        const studentInputs: UpsertStudentInput[] = [...studentByKey.values()];

        const studentsResult = await this.studentsService.bulkUpsert(
          studentInputs,
          manager,
        );

        // Same parent-from-student-email upsert as the single-add path,
        // batched per unique student.
        for (const s of studentInputs) {
          await this.parentsService.ensureForStudent(
            tenantId,
            {
              email: s.email,
              name: s.name,
              phoneNumber: s.phoneNumber,
              branch: s.branchCode,
              admissionNumber: s.admissionNumber,
            },
            manager,
          );
        }

        const feeInputs: CreateFeeInput[] = rows.map((r) => {
          const rowBranchCode = r.branchCode || branch;
          const studentId = studentsResult.idByKey.get(
            this.studentsService.key(r.admissionNumber, r.academicYear),
          );
          if (!studentId) {
            throw new Error(
              `Student ID not found for ${r.admissionNumber} / ${r.academicYear}`,
            );
          }
          return {
            tenantId,
            branch: rowBranchCode,
            academicYear: r.academicYear,
            studentId,
            term: r.term,
            originalAmount: r.amount,
            totalDiscount: r.discount,
          };
        });

        const feesCreated = await this.feesService.bulkCreate(
          feeInputs,
          manager,
        );

        this.logger.log(
          `Upload committed: ${studentsResult.created} new students, ${studentsResult.updated} updated, ${feesCreated} fees`,
        );

        return {
          message: 'Upload completed successfully',
          studentsCreated: studentsResult.created,
          studentsUpdated: studentsResult.updated,
          feesCreated,
        };
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        this.logger.warn(
          `Unique constraint violation during upload: ${(err as Error).message}`,
        );
        throw new ConflictException(
          'A concurrent upload has already saved some of these records. Please re-validate and try again.',
        );
      }
      throw err;
    }
  }

  /**
   * Single-student create path used by the "Add student" UI form.
   * Mirrors the upload pipeline but for one row.
   */
  async createOne(
    tenantId: string,
    branchCode: string,
    dto: {
      academicYear: string;
      admissionNumber: string;
      name: string;
      email: string;
      phoneNumber: string;
      class: string;
      section: string;
      rollNo: string;
      imgUrl?: string | null;
      identityId?: string;
      type?: StudentType;
      terms?: { term: string; amount: number; discount?: number }[];
    },
  ) {
    // Resolve / create the identity OUTSIDE the transaction so a fresh
    // identity row is visible across all subsequent queries.
    let identityId = dto.identityId;
    if (identityId) {
      // Validate the caller passed a real identity for their tenant.
      await this.identitiesService.findOne(tenantId, identityId);
    } else {
      const created = await this.identitiesService.create(tenantId, {
        displayName: dto.name.trim(),
        primaryEmail: dto.email.trim().toLowerCase() || null,
        primaryPhone: dto.phoneNumber.trim() || null,
      });
      identityId = created.id;
    }

    return this.dataSource.transaction(async (manager) => {
      const studentResult = await this.studentsService.bulkUpsert(
        [
          {
            tenantId,
            branchCode,
            type: dto.type ?? null,
            admissionNumber: dto.admissionNumber.trim(),
            academicYear: dto.academicYear.trim(),
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            phoneNumber: dto.phoneNumber.trim(),
            class: dto.class.trim(),
            section: dto.section.trim(),
            rollNo: dto.rollNo.trim(),
            imgUrl: dto.imgUrl ?? null,
          },
        ],
        manager,
      );
      const studentId = studentResult.idByKey.get(
        this.studentsService.key(dto.admissionNumber.trim(), dto.academicYear.trim()),
      );
      if (!studentId) {
        throw new BadRequestException('Failed to upsert student');
      }

      // Stamp the identity on the row. bulkUpsert doesn't take it as
      // an input field, so do it here.
      await manager
        .getRepository(Student)
        .update({ id: studentId }, { identityId });

      // Parent contact on the student form is the parent's login email.
      // Upsert the Parent + link so the parent can log in immediately.
      await this.parentsService.ensureForStudent(
        tenantId,
        {
          email: dto.email,
          name: dto.name,
          phoneNumber: dto.phoneNumber,
          branch: branchCode,
          admissionNumber: dto.admissionNumber.trim(),
        },
        manager,
      );

      let feesCreated = 0;
      if (dto.terms?.length) {
        feesCreated = await this.feesService.bulkCreate(
          dto.terms.map((t) => ({
            tenantId,
            branch: branchCode,
            academicYear: dto.academicYear.trim(),
            studentId,
            term: t.term as any,
            originalAmount: t.amount,
            totalDiscount: t.discount ?? 0,
          })),
          manager,
        );
      }

      return {
        message: 'Student created',
        studentId,
        studentsCreated: studentResult.created,
        studentsUpdated: studentResult.updated,
        feesCreated,
      };
    });
  }
}