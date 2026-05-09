import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantConfigsService } from './tenant-configs.service';
import { CreateTenantConfigDto } from './dto/create-tenant-config.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantConfig } from './entities/tenant-config.entity';
import { Role } from '../../common/enums/roles.enum';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('tenant-configs')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant-configs')
export class TenantConfigsController {
  constructor(private readonly tenantConfigsService: TenantConfigsService) {}

  // POST /tenant-configs
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateTenantConfigDto): Promise<TenantConfig> {
    return this.tenantConfigsService.create(dto);
  }

  // POST /tenant-configs/upsert
  @Post('upsert')
  upsert(@Body() dto: CreateTenantConfigDto): Promise<TenantConfig> {
    return this.tenantConfigsService.upsert(dto);
  }

  // GET /tenant-configs
  @Get()
  findAll(): Promise<TenantConfig[]> {
    return this.tenantConfigsService.findAll();
  }

  // GET /tenant-configs/tenant/:tenantId
  @Get('tenant/:tenantId')
  findByTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<TenantConfig[]> {
    return this.tenantConfigsService.findByTenant(tenantId);
  }

  // GET /tenant-configs/:id
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TenantConfig> {
    return this.tenantConfigsService.findOne(id);
  }

  // PATCH /tenant-configs/:id
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantConfigDto,
  ): Promise<TenantConfig> {
    return this.tenantConfigsService.update(id, dto);
  }

  // DELETE /tenant-configs/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tenantConfigsService.remove(id);
  }
}
