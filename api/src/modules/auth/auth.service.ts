import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AdminsService } from '../admins/admins.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly adminsService: AdminsService,
  ) {}

  async login(user: any): Promise<{ accessToken: string; refreshToken: string }> {
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
      expiresIn: Number(this.configService.get('jwt.refreshExpiresIn')) || 604800, // 7 days in seconds
    });

    const hash = await bcrypt.hash(refreshToken, 10);
    await this.storeRefreshToken(user.id, hash, user._source);

    return { accessToken, refreshToken };
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

    // Check admins table first, then users
    const admin = await this.adminsService.findByEmail(payload.email);
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
    // Try to clear from both tables (one will be a no-op)
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
      expiresIn: Number(this.configService.get<string>('jwt.refreshExpiresIn')) || 604800, // 7 days in seconds
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
