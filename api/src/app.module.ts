import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { AdminsModule } from './modules/admins/admins.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenantConfigsModule } from './modules/tenant-configs/tenant-configs.module';
import { TenantAdminsModule } from './modules/tenant-admins/tenant-admins.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { StudentsModule } from './modules/students/students.module';
import { FeesModule } from './modules/fees/fees.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PenaltiesModule } from './modules/penalties/penalties.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ParentAuthModule } from './modules/parent-auth/parent-auth.module';
import { ParentPortalModule } from './modules/parent-portal/parent-portal.module';
import { SystemMetadataModule } from './modules/system-metadata/system-metadata.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReceiptTemplatesModule } from './modules/receipt-templates/receipt-templates.module';
import { SocialModule } from './modules/social/social.module';
import { StudentIdentitiesModule } from './modules/student-identities/student-identities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get<boolean>('database.sync'),
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AdminsModule,
    UsersModule,
    TenantsModule,
    TenantConfigsModule,
    TenantAdminsModule,
    AcademicYearsModule,
    StudentsModule,
    FeesModule,
    PaymentsModule,
    PenaltiesModule,
    TemplatesModule,
    AnnouncementsModule,
    MediaModule,
    NotificationsModule,
    ReportsModule,
    DashboardModule,
    // Parent portal — OTP login + read endpoints scoped per parent
    ParentsModule,
    ParentAuthModule,
    ParentPortalModule,
    SystemMetadataModule,
    ChatModule,
    ReceiptTemplatesModule,
    SocialModule,
    StudentIdentitiesModule,
  ],
})
export class AppModule {}
