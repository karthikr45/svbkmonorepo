import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

export type SafeTenant = Omit<Tenant, 'clientId' | 'secretKey'>;

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  private sanitize(tenant: Tenant): SafeTenant {
    const { clientId: _c, secretKey: _s, ...safe } = tenant;
    return safe;
  }

  async create(dto: CreateTenantDto): Promise<SafeTenant> {
    const existing = await this.tenantsRepository.findOne({
      where: [
        ...(dto.code ? [{ code: dto.code }] : []),
        { tenantCode: dto.tenantCode },
      ],
    });

    if (existing) {
      throw new ConflictException(
        'A tenant with the same code or tenantCode already exists',
      );
    }

    const clientId = `client_${randomBytes(8).toString('hex')}`;
    const secretKey = randomBytes(32).toString('hex');

    const tenant = this.tenantsRepository.create({ ...dto, clientId, secretKey });
    return this.sanitize(await this.tenantsRepository.save(tenant));
  }

  async findAll(): Promise<SafeTenant[]> {
    const tenants = await this.tenantsRepository.find();
    return tenants.map((t) => this.sanitize(t));
  }

  async findOne(id: string): Promise<SafeTenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return this.sanitize(tenant);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<SafeTenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    Object.assign(tenant, dto);
    return this.sanitize(await this.tenantsRepository.save(tenant));
  }

  /** Used by the admission-number generator to read the tenant's pattern. */
  async findRaw(id: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({ where: { id } });
  }

  async remove(_id: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
