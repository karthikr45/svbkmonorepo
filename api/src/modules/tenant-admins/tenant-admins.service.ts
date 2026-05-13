import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminsService, SafeAdmin } from '../admins/admins.service';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { Role, TENANT_MANAGEABLE_ROLES } from '../../common/enums/roles.enum';

/**
 * Tenant-scoped user management — exposed to the tenant's own ADMIN so they
 * can add fin/ops admins (or peer admins) to their own tenant. Backed by the
 * `admins` table; we don't keep a separate tenant_admins entity.
 */
@Injectable()
export class TenantAdminsService {
  constructor(private readonly adminsService: AdminsService) {}

  private ensureAssignableRole(role: Role) {
    if (!TENANT_MANAGEABLE_ROLES.includes(role)) {
      throw new ForbiddenException(
        `Role ${role} cannot be assigned from the tenant admin console.`,
      );
    }
  }

  async list(tenantId: string): Promise<SafeAdmin[]> {
    return this.adminsService.findAll(tenantId);
  }

  async create(tenantId: string, dto: CreateTenantAdminDto): Promise<SafeAdmin> {
    this.ensureAssignableRole(dto.role);
    return this.adminsService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      role: dto.role,
      branch: dto.branch,
      tenantId,
      password: dto.password,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTenantAdminDto,
  ): Promise<SafeAdmin> {
    const target = await this.adminsService.findById(id);
    if (!target || target.tenantId !== tenantId) {
      throw new NotFoundException(`User ${id} not found in this tenant`);
    }
    if (dto.role) this.ensureAssignableRole(dto.role);
    return this.adminsService.update(id, dto);
  }

  async remove(tenantId: string, id: string, callerId: string): Promise<void> {
    if (id === callerId) {
      throw new ForbiddenException('You cannot delete your own account.');
    }
    const target = await this.adminsService.findById(id);
    if (!target || target.tenantId !== tenantId) {
      throw new NotFoundException(`User ${id} not found in this tenant`);
    }
    await this.adminsService.remove(id);
  }
}
