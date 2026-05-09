import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templatesRepository: Repository<Template>,
  ) {}

  async create(tenantId: string, dto: CreateTemplateDto): Promise<Template> {
    const template = this.templatesRepository.create({ ...dto, tenantId });
    return this.templatesRepository.save(template);
  }

  async findAll(tenantId: string): Promise<Template[]> {
    return this.templatesRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'message', 'status', 'category', 'createdAt'],
    });
  }

  async findOne(tenantId: string, id: string): Promise<Template> {
    const template = await this.templatesRepository.findOne({
      where: { id, tenantId },
      select: ['id', 'name', 'message', 'status', 'category', 'createdAt'],
    });
    if (!template) {
      throw new NotFoundException(`Template not found`);
    }
    return template;
  }

  async update(tenantId: string, id: string, dto: UpdateTemplateDto): Promise<Template> {
    const template = await this.findOne(tenantId, id);
    Object.assign(template, dto);
    return this.templatesRepository.save(template);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const template = await this.findOne(tenantId, id);
    await this.templatesRepository.remove(template);
  }
}
