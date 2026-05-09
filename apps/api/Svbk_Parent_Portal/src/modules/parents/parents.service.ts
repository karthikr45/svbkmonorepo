import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parent } from './entities/parent.entity';

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
  ) {}

  async findByEmail(email: string): Promise<Parent | null> {
    return this.parentRepo.findOne({ where: { email, isActive: true } });
  }

  async findById(id: string): Promise<Parent | null> {
    return this.parentRepo.findOne({ where: { id } });
  }

  async updateRefreshToken(id: string, hash: string | null): Promise<void> {
    await this.parentRepo.update(id, { refreshTokenHash: hash });
  }
}
