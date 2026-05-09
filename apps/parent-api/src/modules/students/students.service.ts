import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  async findByParentId(parentId: string): Promise<Student[]> {
    return this.studentRepo.find({
      where: { parentId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string, parentId?: string): Promise<Student | null> {
    const where: any = { id };
    if (parentId) where.parentId = parentId;
    return this.studentRepo.findOne({ where });
  }
}
