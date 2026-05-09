import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';

@Injectable()
export class TenantAdminsService {
  constructor(private readonly usersService: UsersService) {}

  async create(_tenantId: string, _dto: CreateTenantAdminDto): Promise<any> {
    // TODO: delegate to usersService — tenantId from JWT
    throw new Error('Not implemented');
  }

  async findAll(_tenantId: string): Promise<any[]> {
    // TODO: delegate to usersService
    throw new Error('Not implemented');
  }

  async remove(_id: string): Promise<void> {
    // TODO: delegate to usersService
    throw new Error('Not implemented');
  }

  async update(_id: string, _dto: UpdateTenantAdminDto): Promise<any> {
    // TODO: delegate to usersService
    throw new Error('Not implemented');
  }
}
