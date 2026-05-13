import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AdminsService } from '../admins/admins.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TenantChoice {
  adminId: string;
  tenantId: string | null;
  tenantName: string | null;
  role: string;
  branch: string | null;
}

export interface SignInDirectResult {
  kind: 'tokens';
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    tenantName: string | null;
    branch: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface SignInSelectionResult {
  kind: 'selection';
  selectionToken: string;
  email: string;
  tenants: TenantChoice[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly adminsService: AdminsService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Validates email+password against every admin row matching that email
   * (same email may exist across tenants, each with its own password).
   * - 0 matches → 401
   * - 1 match  → returns tokens immediately
   * - 2+ matches → returns a short-lived selection token + tenant list so
   *   the UI can prompt the user to pick a tenant.
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<SignInDirectResult | SignInSelectionResult> {
    const candidates = await this.adminsService.findAllByEmail(email);
    const matched: typeof candidates = [];
    for (const c of candidates) {
      if (!c.isActive) continue;
      if (await bcrypt.compare(password, c.passwordHash)) matched.push(c);
    }

    if (matched.length === 0) {
      // Fall back to users table (parents etc.)
      const user = await this.usersService.findByEmail(email);
      if (user && user.isActive && user.passwordHash) {
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (ok) return this.issueTokens(user as any, 'user');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (matched.length === 1) {
      return this.issueTokens(matched[0], 'admin');
    }

    // 2+ matches → return tenant picker.
    const tenants: TenantChoice[] = [];
    for (const a of matched) {
      let tenantName: string | null = null;
      if (a.tenantId) {
        try {
          const t = await this.tenantsService.findOne(a.tenantId);
          tenantName = t.tenantName ?? t.name ?? null;
        } catch {
          tenantName = null;
        }
      }
      tenants.push({
        adminId: a.id,
        tenantId: a.tenantId ?? null,
        tenantName,
        role: a.role,
        branch: a.branch ?? null,
      });
    }

    const selectionToken = this.jwtService.sign(
      { purpose: 'tenant-selection', email, adminIds: matched.map((m) => m.id) },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: 300, // 5 minutes
      },
    );

    return { kind: 'selection', selectionToken, email, tenants };
  }

  /**
   * Exchanges a selection token + chosen adminId/tenantId for a full session.
   */
  async selectTenant(
    selectionToken: string,
    adminId: string,
  ): Promise<SignInDirectResult> {
    let claims: { purpose?: string; email?: string; adminIds?: string[] };
    try {
      claims = this.jwtService.verify(selectionToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Selection token expired or invalid');
    }
    if (claims.purpose !== 'tenant-selection' || !claims.adminIds?.includes(adminId)) {
      throw new UnauthorizedException('Selection token does not authorise this admin');
    }
    const admin = await this.adminsService.findById(adminId);
    if (!admin || !admin.isActive) throw new NotFoundException('Admin not found');
    if (admin.email !== claims.email) {
      throw new UnauthorizedException('Selection token mismatch');
    }
    return this.issueTokens(admin, 'admin');
  }

  private async issueTokens(
    user: any,
    source: 'admin' | 'user',
  ): Promise<SignInDirectResult> {
    let tenantName: string | null = null;
    if (user.tenantId) {
      try {
        const t = await this.tenantsService.findOne(user.tenantId);
        tenantName = t.tenantName ?? t.name ?? null;
      } catch {
        tenantName = null;
      }
    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? null,
      branch: user.branch ?? null,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn:
        Number(this.configService.get('jwt.refreshExpiresIn')) || 604800,
    });
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.storeRefreshToken(user.id, hash, source);
    return {
      kind: 'tokens',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId ?? null,
        tenantName,
        branch: user.branch ?? null,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Disambiguate by id (sub), not email — emails are no longer unique.
    const admin = await this.adminsService.findById(payload.sub);
    if (admin?.refreshTokenHash) {
      const isMatch = await bcrypt.compare(refreshToken, admin.refreshTokenHash);
      if (isMatch) {
        return this.issueNewTokenPair(payload, admin.id, 'admin');
      }
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (user?.refreshTokenHash) {
      const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (isMatch) {
        return this.issueNewTokenPair(payload, user.id, 'user');
      }
    }

    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async logout(userId: string): Promise<void> {
    await Promise.allSettled([
      this.adminsService.updateRefreshToken(userId, null),
      this.usersService.updateRefreshToken(userId, null),
    ]);
  }

  private async issueNewTokenPair(
    payload: JwtPayload,
    entityId: string,
    source: 'admin' | 'user',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const newPayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      branch: payload.branch,
    };

    const newAccessToken = this.jwtService.sign(newPayload);
    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn:
        Number(this.configService.get<string>('jwt.refreshExpiresIn')) || 604800,
    });

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    await this.storeRefreshToken(entityId, newHash, source);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  private async storeRefreshToken(
    entityId: string,
    hash: string | null,
    source: 'admin' | 'user',
  ): Promise<void> {
    if (source === 'admin') {
      await this.adminsService.updateRefreshToken(entityId, hash);
    } else {
      await this.usersService.updateRefreshToken(entityId, hash);
    }
  }
}
