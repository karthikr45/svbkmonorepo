import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StudentsService } from '../students/students.service';
import { FeesService } from './fees.service';

@ApiTags('Fees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fees')
export class FeesController {
  constructor(
    private readonly feesService: FeesService,
    private readonly studentsService: StudentsService,
  ) {}

  @Get('students/:studentId')
  @ApiOperation({ summary: "Get a student's fee records (optionally filter by term/year)" })
  @ApiQuery({ name: 'term', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: String })
  async getStudentFees(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: any,
    @Query('term') term?: string,
    @Query('year') year?: string,
  ) {
    const student = await this.studentsService.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    if (student.parentId !== user.parentId) throw new ForbiddenException('Access denied');

    const fees = await this.feesService.findByStudentId(
      studentId,
      term ? parseInt(term, 10) : undefined,
      year,
    );
    const summary = this.feesService.buildFeeSummary(fees);

    return {
      student: {
        id: student.id,
        name: student.name,
        studentId: student.studentId,
        grade: student.grade,
        section: student.section,
        school: student.school,
      },
      fees: fees.map((f) => ({
        id: f.id,
        feeType: f.feeType,
        termNumber: f.termNumber,
        academicYear: f.academicYear,
        totalAmount: Number(f.totalAmount),
        paidAmount: Number(f.paidAmount),
        dueAmount: Number(f.totalAmount) - Number(f.paidAmount),
        status: f.status,
        dueDate: f.dueDate,
        paidDate: f.paidDate,
        receiptNumber: f.receiptNumber,
      })),
      summary,
    };
  }
}
