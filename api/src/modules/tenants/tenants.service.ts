import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ReceiptTemplatesService } from '../receipt-templates/receipt-templates.service';

export type SafeTenant = Omit<Tenant, 'clientId' | 'secretKey'>;

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @Inject(forwardRef(() => ReceiptTemplatesService))
    private readonly receiptTemplates: ReceiptTemplatesService,
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
    const saved = await this.tenantsRepository.save(tenant);
    // Seed a starter receipt template so the school can issue receipts
    // immediately. Pulled from system_metadata so the starter HTML
    // itself stays in the database, not in code.
    try {
      await this.receiptTemplates.ensureStarterForTenant(saved.id);
    } catch {
      /* non-fatal — admin can create one manually later */
    }
    return this.sanitize(saved);
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

  async remove(_id: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
