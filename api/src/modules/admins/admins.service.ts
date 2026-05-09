import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

const DEFAULT_ADMIN_PASSWORD = 'Svbk@1234';

export type SafeAdmin = Omit<Admin, 'clientId' | 'secretKey' | 'passwordHash'>;

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
  ) {}

  private sanitize(admin: Admin): SafeAdmin {
    const { clientId: _c, secretKey: _s, passwordHash: _p, ...safe } = admin;
    return safe;
  }

  async create(dto: CreateAdminDto): Promise<SafeAdmin> {
    const existing = await this.adminsRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An admin with this email already exists');
    }

    const clientId = `client_${randomBytes(8).toString('hex')}`;
    const secretKey = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

    const admin = this.adminsRepository.create({ ...dto, clientId, secretKey, passwordHash });
    return this.sanitize(await this.adminsRepository.save(admin));
  }

  async findAll(tenantId: string): Promise<SafeAdmin[]> {
    const admins = await this.adminsRepository.find({ where: { tenantId } });
    return admins.map((a) => this.sanitize(a));
  }

  async findOne(id: string): Promise<SafeAdmin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin ${id} not found`);
    return this.sanitize(admin);
  }

  async update(id: string, dto: UpdateAdminDto): Promise<SafeAdmin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin ${id} not found`);

    if (dto.password) {
      admin.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const { password: _pw, ...rest } = dto;
    Object.assign(admin, rest);
    return this.sanitize(await this.adminsRepository.save(admin));
  }

  async remove(id: string): Promise<void> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin ${id} not found`);
    await this.adminsRepository.remove(admin);
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.adminsRepository.findOne({ where: { email } });
  }

  async updateRefreshToken(adminId: string, hash: string | null): Promise<void> {
    await this.adminsRepository.update(adminId, { refreshTokenHash: hash });
  }
}
