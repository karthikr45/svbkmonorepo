import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { StudentsService } from './students.service';
import { UploadService } from './upload.service';
import { StudentFeesService } from '../fees/student-fees.service';
import { UpdateStudentDto } from './dto/student.dto';
import { UpdateStudentWithFeesDto } from './dto/update-student-with-fees.dto';
import {
  AcademicYearQueryDto,
  StudentByAdmissionQueryDto,
} from './dto/query.dto';
import {
  ValidateUploadResponseDto,
  ConfirmUploadResponseDto,
} from './dto/upload.dto';
import { ListStudentsQueryDto } from './dto/list.dto';
import { MAX_UPLOAD_SIZE_BYTES } from './constants/excel.constants';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeesService } from '../fees/fees.service';
import { PaymentType } from '../fees/entities/fee-payment.entity';
import { TermType } from '../fees/entities/fee.entity';



@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly uploadService: UploadService,
    private readonly studentFeesService: StudentFeesService,
    private readonly feesService: FeesService,
  ) {}

  // ─────────────── Upload ───────────────

  @Post('upload/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate Excel upload',
    description:
      'Parses the uploaded .xlsx/.csv and validates every row. No DB writes. Branch is taken from the JWT.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx) or CSV file',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async validateUpload(
    @UploadedFile(buildFilePipe()) file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<ValidateUploadResponseDto> {
    const { tenantId, branch } = ctxWithBranch(req);
    return this.uploadService.validateFile(file.buffer, tenantId, branch);
  }

  @Post('upload/confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirm and save Excel upload',
    description:
      'Re-validates the file server-side and persists atomically. Branch is taken from the JWT.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx) or CSV file',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async confirmUpload(
    @UploadedFile(buildFilePipe()) file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<ConfirmUploadResponseDto> {
    const { tenantId, branch } = ctxWithBranch(req);
    return this.uploadService.confirmUpload(file.buffer, tenantId, branch);
  }

  // ─────────────── Student read / edit ───────────────

  @Get()
  @ApiOperation({
    summary: 'List students with fees',
    description:
      'Paginated list of students for the tenant, each enriched with their fees (and payment history) for the student\'s academic year. Filter by academic year, class, section, or free-text search on name/admission. Branch comes from the JWT — users see only their own branch; super-admins with no branch on the JWT see all branches within the tenant.',
  })
  async list(
    @Query() query: ListStudentsQueryDto,
    @Req() req: Request,
  ) {
    const { tenantId, branch } = ctx(req);
    const result = await this.studentsService.list(tenantId, {
      ...query,
      branch: branch ?? undefined,
    });
    const feesByStudent = await this.studentFeesService.getFeesForStudents(
      tenantId,
      result.items.map((s) => ({
        studentId: s.id,
        academicYear: s.academicYear,
      })),
    );
    return {
      ...result,
      items: result.items.map((s) => ({
        ...s,
        fees: feesByStudent.get(s.id) ?? [],
      })),
    };
  }

  @Get('by-admission/with-fees')
  @ApiOperation({
    summary: 'Get student + fees by admission number',
    description: 'Branch is taken from the JWT.',
  })
  async getByAdmissionWithFees(
    @Query() query: StudentByAdmissionQueryDto,
    @Req() req: Request,
  ) {
    const { tenantId, branch } = ctxWithBranch(req);
    const student = await this.studentsService.findByAdmissionYear(
      tenantId,
      branch,
      query.admissionNumber,
      query.academicYear,
    );
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }

  @Get('latest')
  @ApiOperation({
    summary: 'Get latest 5 students',
    description: 'Returns the 5 most recently created students for the tenant, ordered by creation date descending.',
  })
  async getLatest(@Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.studentsService.getLatest(tenantId);
  }

  @Get(':id/with-fees')
  @ApiOperation({ summary: 'Get student + fees by UUID' })
  @ApiParam({ name: 'id', description: 'Student UUID', example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f' })
  async getWithFees(
    @Param('id', buildUuidPipe('id')) id: string,
    @Query() query: AcademicYearQueryDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const student = await this.studentsService.findOneOrFail(tenantId, id);
    if (student.academicYear !== query.academicYear) {
      throw new BadRequestException(
        `Student's academic year is ${student.academicYear}, not ${query.academicYear}`,
      );
    }
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student profile by UUID' })
  @ApiParam({
    name: 'id',
    description: 'Student UUID',
    example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f',
  })
  async getOne(
    @Param('id', buildUuidPipe('id')) id: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const student = await this.studentsService.findOneOrFail(tenantId, id);
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update student profile',
    description:
      'Partial update. Identity fields (admission_number, academic_year, tenant, branch) cannot be changed.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID', example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f' })
  async patchUpdate(
    @Param('id', buildUuidPipe('id')) id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.studentsService.update(tenantId, id, dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update student + fees (legacy payload)',
    description:
      'Accepts older frontend payload shape (phone, admissionNumber, termFees). admissionNumber is ignored. Student fields update and additional payments are recorded against matching term fees.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID', example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f' })
  async putUpdateLegacy(
    @Param('id', buildUuidPipe('id')) id: string,
    @Body() dto: UpdateStudentWithFeesDto,
    @Req() req: Request,
  ) {
    const { tenantId, userId } = ctx(req);

    // Update student profile (map legacy phone -> phoneNumber). Ignore admissionNumber.
    const studentUpdate: UpdateStudentDto = {
      name: dto.name,
      class: dto.class,
      section: dto.section,
      rollNo: dto.rollNo,
      email: dto.email,
      phoneNumber: dto.phone,
    };
    const updatedStudent = await this.studentsService.update(
      tenantId,
      id,
      studentUpdate,
    );

    // Apply fee payment deltas (we only ever ADD payments; cannot reduce history).
    if (dto.termFees && Object.keys(dto.termFees).length) {
      const student = await this.studentsService.findOneOrFail(tenantId, id);
      const summaries = await this.studentFeesService.getFeesForStudent(
        tenantId,
        id,
        student.academicYear,
      );
      const byTerm = new Map<string, (typeof summaries)[number]>();
      for (const s of summaries) byTerm.set(s.term, s);

      for (const [termKey, raw] of Object.entries(dto.termFees)) {
        if (!Object.values(TermType).includes(termKey as TermType)) continue;
        const summary = byTerm.get(termKey);
        if (!summary) continue;

        const desiredPaidRaw =
          raw?.paidAmount ?? raw?.feePaid ?? raw?.amountPaid ?? null;
        const desiredPaid =
          desiredPaidRaw === null || desiredPaidRaw === undefined
            ? NaN
            : Number(desiredPaidRaw);
        if (!Number.isFinite(desiredPaid) || desiredPaid < 0) continue;

        const currentPaid = Number(summary.paidAmount);
        const delta = desiredPaid - currentPaid;
        if (delta < -0.01) {
          throw new BadRequestException(
            `Cannot reduce paid amount for "${termKey}". Current=${currentPaid}, requested=${desiredPaid}`,
          );
        }
        if (delta <= 0.01) continue;

        const paymentType = mapPaymentType(raw?.paymentType);
        const paidAt = raw?.paymentDate ?? raw?.receiptDate ?? raw?.paidAt;
        const bankName = raw?.bankName;
        const ddNumber = raw?.ddNumber;

        await this.feesService.recordOfflinePayment(tenantId, summary.feeId, {
          amount: delta,
          paymentType,
          bankName: typeof bankName === 'string' ? bankName : undefined,
          paidAt: typeof paidAt === 'string' ? paidAt : undefined,
          ddNumber:
            paymentType === PaymentType.DD && typeof ddNumber === 'string'
              ? ddNumber
              : undefined,
          chequeNumber:
            paymentType === PaymentType.CHEQUE && typeof ddNumber === 'string'
              ? ddNumber
              : undefined,
          recordedBy: userId ?? null,
        });
      }
    }

    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      id,
      updatedStudent.academicYear,
    );
    return { student: updatedStudent, fees };
  }
}

function mapPaymentType(input: unknown): PaymentType {
  const v = typeof input === 'string' ? input.trim() : '';
  if (!v) return PaymentType.CASH;
  const norm = v.toUpperCase().replace(/\s+/g, '');
  if (norm === 'CASH') return PaymentType.CASH;
  if (norm === 'CHEQUE' || norm === 'CHECK') return PaymentType.CHEQUE;
  if (norm === 'DD' || norm === 'DEMANDDRAFT') return PaymentType.DD;
  if (norm === 'NEFT') return PaymentType.NEFT;
  // Default to CASH for unknown legacy values like "Cash"
  return PaymentType.CASH;
}

// ─────────────── helpers ───────────────

interface AuthContext {
  tenantId: string;
  userId: string;
  branch: string | null;
}

function ctx(req: Request): AuthContext {
  const user = (req as any).user;
  if (!user?.tenantId || !user?.userId) {
    throw new UnauthorizedException('Authentication required');
  }
  return {
    tenantId: user.tenantId,
    userId: user.userId,
    branch: user.branch ?? null,
  };
}

/** Variant that requires the user's JWT to carry a branch. Throws 403 otherwise. */
function ctxWithBranch(req: Request): AuthContext & { branch: string } {
  const c = ctx(req);
  if (!c.branch) {
    throw new ForbiddenException(
      'Your account is not scoped to a branch — this endpoint requires a branch-scoped token.',
    );
  }
  return { ...c, branch: c.branch };
}

function buildUuidPipe(paramName: string) {
  return new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new BadRequestException(`${paramName} must be a valid UUID`),
  });
}

function buildFilePipe() {
  return new ParseFilePipe({
    fileIsRequired: true,
    exceptionFactory: (error) =>
      new BadRequestException(
        typeof error === 'string' && error.length
          ? error
          : 'file is required (multipart form field: "file")',
      ),
    validators: [
      new MaxFileSizeValidator({
        maxSize: MAX_UPLOAD_SIZE_BYTES,
        message: (maxSize) =>
          `file exceeds the maximum allowed size of ${maxSize} bytes`,
      }),
      new FileTypeValidator({
        fileType:
          /(spreadsheetml\.sheet|vnd\.ms-excel|text\/csv|application\/csv)/,
      }),
    ],
  });
}
