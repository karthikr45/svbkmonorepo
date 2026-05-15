import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { SocialPost } from './entities/social-post.entity';
import { SocialPostImage } from './entities/social-post-image.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialPost, SocialPostImage, Admin, Tenant]),
  ],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
