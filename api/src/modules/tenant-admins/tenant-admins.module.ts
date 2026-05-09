import { Module } from '@nestjs/common';
import { TenantAdminsController } from './tenant-admins.controller';
import { TenantAdminsService } from './tenant-admins.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [TenantAdminsController],
  providers: [TenantAdminsService],
})
export class TenantAdminsModule {}
