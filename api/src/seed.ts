/**
 * SVBK Seed Script
 * Usage: npm run seed
 *
 * Creates the super admin in the admins table.
 * Skips if already exists (idempotent).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Admin } from './modules/admins/entities/admin.entity';
import { Role } from './common/enums/roles.enum';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminsRepo = app.get<Repository<Admin>>(getRepositoryToken(Admin));

  const SALT_ROUNDS = 10;
  const superAdminEmail = 'superadmin@svbk.com';

  const existing = await adminsRepo.findOne({ where: { email: superAdminEmail } }).catch(() => null);

  if (existing) {
    console.log('↩ Super admin already exists:', superAdminEmail);
  } else {
    const passwordHash = await bcrypt.hash('Admin@123', SALT_ROUNDS);
    const clientId = `client_${randomBytes(8).toString('hex')}`;
    const secretKey = randomBytes(32).toString('hex');

    const superAdmin = adminsRepo.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: superAdminEmail,
      role: Role.SUPER_ADMIN,
      branch: 'HYD',
      clientId,
      secretKey,
      passwordHash,
    });

    await adminsRepo.save(superAdmin);
    console.log('✔ Super admin created:', superAdminEmail);
    console.log('  clientId  :', clientId);
    console.log('  secretKey :', secretKey);
  }

  await app.close();
  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
