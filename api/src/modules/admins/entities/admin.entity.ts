import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Role } from '../../../common/enums/roles.enum';

@Entity('admins')
// Same email can exist in multiple tenants, but not twice within the same
// tenant. Super-admins (tenantId NULL) are guarded at the service level
// because Postgres treats NULLs as distinct in unique constraints.
@Unique('uq_admin_email_tenant', ['email', 'tenantId'])
@Index('idx_admin_email', ['email'])
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ nullable: true })
  branch: string;

  @Column({ unique: true })
  clientId: string;

  @Column()
  secretKey: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  tenantId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  refreshTokenHash: string | null = null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
