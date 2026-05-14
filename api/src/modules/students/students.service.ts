import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { Student } from './entities/student.entity';
import {
  UpsertStudentInput,
  UpsertStudentsResult,
  UpdateStudentDto,
} from './dto/student.dto';

/** Chunk size for batched saves. 500 keeps us under Postgres' param limit. */
const BATCH_SIZE = 500;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  /**
   * Find one student by id, scoped to tenant. Throws 404 if not found
   * or belongs to a different tenant.
   */
  async findOneOrFail(tenantId: string, id: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id, tenantId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${id} not found`);
    }
    return student;
  }

  /**
   * Find by admission number + academic year. Used by the admin UI when
   * the user searches by admission.
   */
  async findByAdmissionYear(
    tenantId: string,
    branch: string,
    admissionNumber: string,
    academicYear: string,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { tenantId, branch, admissionNumber, academicYear },
    });
    if (!student) {
      throw new NotFoundException(
        `Student with admission ${admissionNumber} not found for ${academicYear}`,
      );
    }
    return student;
  }

  /**
   * Partial update. Only fields present in `dto` are changed. Returns
   * the updated entity.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateStudentDto,
  ): Promise<Student> {
    const student = await this.findOneOrFail(tenantId, id);

    if (dto.name !== undefined) student.name = dto.name;
    if (dto.email !== undefined) student.email = dto.email.toLowerCase();
    if (dto.phoneNumber !== undefined) student.phoneNumber = dto.phoneNumber;
    if (dto.class !== undefined) student.class = dto.class;
    if (dto.section !== undefined) student.section = dto.section;
    if (dto.rollNo !== undefined) student.rollNo = dto.rollNo;
    if (dto.imgUrl !== undefined) student.imgUrl = dto.imgUrl;

    const saved = await this.studentRepo.save(student);
    this.logger.log(`Updated student ${id}`);
    return saved;
  }

  async getLatest(tenantId: string): Promise<Student[]> {
    return this.studentRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }

  /**
   * Bulk upsert used by the Excel upload flow. Runs inside the caller's
   * transaction so students + fees commit together.
   */
  async bulkUpsert(
    inputs: UpsertStudentInput[],
    manager: EntityManager,
  ): Promise<UpsertStudentsResult> {
    const repo = manager.getRepository(Student);
    const idByKey = new Map<string, string>();

    if (!inputs.length) return { created: 0, updated: 0, idByKey };

    const { tenantId, branch } = inputs[0];

    // 1. Load all existing students for this upload in one query
    const admissions = [...new Set(inputs.map((i) => i.admissionNumber))];
    const years = [...new Set(inputs.map((i) => i.academicYear))];

    const existing = await repo.find({
      where: {
        tenantId,
        branch,
        admissionNumber: In(admissions),
        academicYear: In(years),
      },
    });

    const existingMap = new Map<string, Student>();
    for (const s of existing) {
      existingMap.set(this.key(s.admissionNumber, s.academicYear), s);
    }

    // 2. Partition into create vs update
    const toCreate: Student[] = [];
    const toUpdate: Student[] = [];

    for (const input of inputs) {
      const k = this.key(input.admissionNumber, input.academicYear);
      const found = existingMap.get(k);

      if (found) {
        found.name = input.name;
        found.email = input.email;
        found.phoneNumber = input.phoneNumber;
        found.class = input.class;
        found.section = input.section;
        found.rollNo = input.rollNo;
        if (input.imgUrl) found.imgUrl = input.imgUrl;
        toUpdate.push(found);
      } else {
        toCreate.push(repo.create(input));
      }
    }

    // 3. Batch inserts
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const chunk = toCreate.slice(i, i + BATCH_SIZE);
      const saved = await repo.save(chunk);
      saved.forEach((s) =>
        idByKey.set(this.key(s.admissionNumber, s.academicYear), s.id),
      );
    }

    // 4. Batch updates
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const chunk = toUpdate.slice(i, i + BATCH_SIZE);
      await repo.save(chunk);
      chunk.forEach((s) =>
        idByKey.set(this.key(s.admissionNumber, s.academicYear), s.id),
      );
    }

    this.logger.log(
      `Upserted students: ${toCreate.length} created, ${toUpdate.length} updated`,
    );
    return { created: toCreate.length, updated: toUpdate.length, idByKey };
  }

  /**
   * Paginated list of students scoped to the tenant. Filters are ANDed:
   * if multiple are passed, all must match.
   *
   * `search` is a case-insensitive contains match on name OR
   * admission_number — the typical search-bar behaviour.
   *
   * Results are ordered by class → section → roll number for a
   * teacher-friendly default.
   */
  async list(
    tenantId: string,
    filters: {
      academicYear?: string;
      branch?: string;
      class?: string;
      section?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: Student[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    const qb = this.studentRepo
      .createQueryBuilder('student')
      .where('student.tenantId = :tenantId', { tenantId });

    if (filters.academicYear) {
      qb.andWhere('student.academicYear = :year', {
        year: filters.academicYear,
      });
    }
    if (filters.branch) {
      qb.andWhere('student.branch = :branch', { branch: filters.branch });
    }
    if (filters.class) {
      qb.andWhere('student.class = :class', { class: filters.class });
    }
    if (filters.section) {
      qb.andWhere('student.section = :section', { section: filters.section });
    }
    if (filters.search) {
      // ILIKE is Postgres-specific case-insensitive match.
      qb.andWhere(
        '(student.name ILIKE :q OR student.admissionNumber ILIKE :q)',
        { q: `%${filters.search}%` },
      );
    }

    qb.orderBy('student.class', 'ASC')
      .addOrderBy('student.section', 'ASC')
      .addOrderBy('student.rollNo', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Shared key format so callers match without duplicating logic. */
  key(admissionNumber: string, academicYear: string): string {
    return `${admissionNumber}::${academicYear}`;
  }
}