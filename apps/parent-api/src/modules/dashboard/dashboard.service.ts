import { Injectable } from '@nestjs/common';
import { FeesService } from '../fees/fees.service';
import { StudentsService } from '../students/students.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly feesService: FeesService,
  ) {}

  async getDashboard(parentId: string, parentName: string, parentEmail: string) {
    const students = await this.studentsService.findByParentId(parentId);

    const children = await Promise.all(
      students.map(async (student) => {
        const fees = await this.feesService.findByStudentId(student.id);
        const summary = this.feesService.buildFeeSummary(fees);

        const feesByTerm: Record<string, any[]> = {};
        for (const fee of fees) {
          const key = `Term ${fee.termNumber} – ${fee.academicYear}`;
          if (!feesByTerm[key]) feesByTerm[key] = [];
          feesByTerm[key].push({
            id: fee.id,
            feeType: fee.feeType,
            termNumber: fee.termNumber,
            academicYear: fee.academicYear,
            totalAmount: Number(fee.totalAmount),
            paidAmount: Number(fee.paidAmount),
            dueAmount: Number(fee.totalAmount) - Number(fee.paidAmount),
            status: fee.status,
            dueDate: fee.dueDate,
            paidDate: fee.paidDate,
            receiptNumber: fee.receiptNumber,
          });
        }

        const latestTerm = fees.length
          ? fees.reduce((a, b) =>
              a.termNumber > b.termNumber ||
              (a.termNumber === b.termNumber && a.academicYear > b.academicYear)
                ? a
                : b,
            )
          : null;

        return {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          grade: student.grade,
          section: student.section,
          school: student.school,
          summary: {
            ...summary,
            term: latestTerm ? `Term ${latestTerm.termNumber}` : null,
            academicYear: latestTerm?.academicYear ?? null,
            label: latestTerm
              ? `${summary.paidCount} of ${summary.totalCount} fees paid · Term ${latestTerm.termNumber} – ${latestTerm.academicYear}`
              : 'No fee records',
          },
          feesByTerm,
        };
      }),
    );

    return {
      parent: { id: parentId, name: parentName, email: parentEmail },
      children,
    };
  }
}
