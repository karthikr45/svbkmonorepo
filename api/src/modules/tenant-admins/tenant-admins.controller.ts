import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantAdminsService } from './tenant-admins.service';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('tenant-admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant-admins')
export class TenantAdminsController {
  constructor(private readonly tenantAdminsService: TenantAdminsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@CurrentUser() _user: any, @Body() _dto: CreateTenantAdminDto) {
    // TODO: implement
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(@CurrentUser() _user: any) {
    // TODO: implement
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id') _id: string, @Body() _dto: UpdateTenantAdminDto) {
    // TODO: implement
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') _id: string) {
    // TODO: implement
  }
}
