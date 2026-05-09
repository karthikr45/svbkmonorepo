import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Parent } from './entities/parent.entity';
import { ParentStudent } from './entities/parent-student.entity';
import { CreateParentDto, ParentStudentLinkDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

@Injectable()
export class ParentsService {
  private readonly logger = new Logger(ParentsService.name);

  constructor(
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(ParentStudent)
    private readonly linkRepo: Repository<ParentStudent>,
    private readonly dataSource: DataSource,
  ) {}

  async create(tenantId: string, dto: CreateParentDto): Promise<Parent> {
    const email = dto.email.toLowerCase();
    const existing = await this.parentRepo.findOne({
      where: { tenantId, email },
    });
    if (existing) {
      throw new ConflictException(
        `A parent with email ${email} already exists for this tenant`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const parent = manager.getRepository(Parent).create({
        tenantId,
        name: dto.name,
        email,
        phoneNumber: dto.phoneNumber ?? null,
        isActive: dto.isActive ?? true,
      });
      const saved = await manager.getRepository(Parent).save(parent);

      const links = dto.students.map((s) =>
        manager.getRepository(ParentStudent).create({
          parentId: saved.id,
          tenantId,
          branch: s.branch,
          admissionNumber: s.admissionNumber,
          relationship: s.relationship,
          isPrimary: s.isPrimary ?? false,
        }),
      );
      await manager.getRepository(ParentStudent).save(links);

      this.logger.log(
        `Created parent ${saved.id} (${email}) with ${links.length} student link(s)`,
      );
      return this.findOneOrFail(tenantId, saved.id);
    });
  }

  async findAll(tenantId: string): Promise<Parent[]> {
    return this.parentRepo.find({
      where: { tenantId },
      relations: ['studentLinks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(tenantId: string, id: string): Promise<Parent> {
    const parent = await this.parentRepo.findOne({
      where: { id, tenantId },
      relations: ['studentLinks'],
    });
    if (!parent) {
      throw new NotFoundException(`Parent ${id} not found`);
    }
    return parent;
  }

  async findByEmailGlobal(email: string): Promise<Parent[]> {
    return this.parentRepo.find({
      where: { email: email.toLowerCase(), isActive: true },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateParentDto,
  ): Promise<Parent> {
    const parent = await this.findOneOrFail(tenantId, id);

    if (dto.email && dto.email.toLowerCase() !== parent.email) {
      const conflict = await this.parentRepo.findOne({
        where: { tenantId, email: dto.email.toLowerCase() },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Email ${dto.email} already in use`);
      }
      parent.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) parent.name = dto.name;
    if (dto.phoneNumber !== undefined) parent.phoneNumber = dto.phoneNumber;
    if (dto.isActive !== undefined) parent.isActive = dto.isActive;

    return this.parentRepo.save(parent);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const parent = await this.findOneOrFail(tenantId, id);
    await this.parentRepo.remove(parent);
  }

  async addStudentLink(
    tenantId: string,
    parentId: string,
    dto: ParentStudentLinkDto,
  ): Promise<ParentStudent> {
    await this.findOneOrFail(tenantId, parentId);
    const existing = await this.linkRepo.findOne({
      where: {
        parentId,
        tenantId,
        branch: dto.branch,
        admissionNumber: dto.admissionNumber,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Parent already linked to admission ${dto.admissionNumber}`,
      );
    }
    const link = this.linkRepo.create({
      parentId,
      tenantId,
      branch: dto.branch,
      admissionNumber: dto.admissionNumber,
      relationship: dto.relationship,
      isPrimary: dto.isPrimary ?? false,
    });
    return this.linkRepo.save(link);
  }

  async removeStudentLink(
    tenantId: string,
    parentId: string,
    linkId: string,
  ): Promise<void> {
    await this.findOneOrFail(tenantId, parentId);
    const link = await this.linkRepo.findOne({
      where: { id: linkId, parentId, tenantId },
    });
    if (!link) {
      throw new NotFoundException(`Student link ${linkId} not found`);
    }
    await this.linkRepo.remove(link);
  }

  async findStudentLinksByParent(parentId: string): Promise<ParentStudent[]> {
    return this.linkRepo.find({ where: { parentId } });
  }

  async updateRefreshToken(
    parentId: string,
    hash: string | null,
  ): Promise<void> {
    await this.parentRepo.update(parentId, { refreshTokenHash: hash });
  }
}
