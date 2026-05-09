import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { LessThan, Repository } from 'typeorm';
import { Role } from '../../common/enums/roles.enum';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Parent } from '../parents/entities/parent.entity';
import { ParentsService } from '../parents/parents.service';
import { ParentOtp } from './entities/otp.entity';

interface ParentJwtPayload {
  sub: string;
  email: string;
  role: Role;
  tenantId: string;
  branch: null;
  name?: string;
}

@Injectable()
export class ParentAuthService {
  private readonly logger = new Logger(ParentAuthService.name);

  constructor(
    @InjectRepository(ParentOtp)
    private readonly otpRepo: Repository<ParentOtp>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly parentsService: ParentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(email: string, tenantCode?: string): Promise<{ message: string }> {
    const parent = await this.resolveParentByEmail(email, tenantCode);

    // Invalidate previous unused OTPs for this email/tenant
    await this.otpRepo.update(
      { tenantId: parent.tenantId, email: parent.email, isUsed: false },
      { isUsed: true },
    );

    const rawOtp = this.generateOtp();
    const hash = await bcrypt.hash(rawOtp, 10);
    const expiresInMinutes =
      this.configService.get<number>('otp.expiresInMinutes') ?? 5;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        tenantId: parent.tenantId,
        email: parent.email,
        otpHash: hash,
        expiresAt,
        isUsed: false,
      }),
    );

    await this.sendOtpEmail(parent.email, parent.name, rawOtp);

    return { message: 'OTP sent successfully. Please check your email.' };
  }

  async verifyOtp(email: string, otp: string, tenantCode?: string) {
    const parent = await this.resolveParentByEmail(email, tenantCode);

    const demoMode = this.configService.get<boolean>('demoMode');
    if (!demoMode) {
      const otpRecord = await this.otpRepo.findOne({
        where: {
          tenantId: parent.tenantId,
          email: parent.email,
          isUsed: false,
        },
        order: { createdAt: 'DESC' },
      });

      if (!otpRecord) {
        throw new BadRequestException('OTP not found. Please request a new one.');
      }
      if (new Date() > otpRecord.expiresAt) {
        await this.otpRepo.update(otpRecord.id, { isUsed: true });
        throw new BadRequestException('OTP has expired. Please request a new one.');
      }

      const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
      if (!isMatch) {
        throw new BadRequestException('Invalid OTP. Please try again.');
      }
      await this.otpRepo.update(otpRecord.id, { isUsed: true });
    }

    const tokens = await this.issueTokenPair(parent);
    return {
      ...tokens,
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        tenantId: parent.tenantId,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: ParentJwtPayload;
    try {
      payload = this.jwtService.verify<ParentJwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.role !== Role.PARENT) {
      throw new UnauthorizedException('Token is not a parent token');
    }

    const parent = await this.parentsService
      .findOneOrFail(payload.tenantId, payload.sub)
      .catch(() => null);
    if (!parent || !parent.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isMatch = await bcrypt.compare(refreshToken, parent.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokenPair(parent);
  }

  async logout(parentId: string): Promise<void> {
    await this.parentsService.updateRefreshToken(parentId, null);
  }

  async cleanExpiredOtps(): Promise<void> {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });
  }

  private async resolveParentByEmail(
    email: string,
    tenantCode?: string,
  ): Promise<Parent> {
    const candidates = await this.parentsService.findByEmailGlobal(email);
    if (candidates.length === 0) {
      throw new NotFoundException('No account found with this email address');
    }

    if (candidates.length === 1 && !tenantCode) {
      return candidates[0];
    }

    if (!tenantCode) {
      throw new ConflictException(
        'This email is registered with multiple schools. Please provide a tenantCode.',
      );
    }

    const tenant = await this.tenantRepo.findOne({
      where: { tenantCode },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantCode} not found`);
    }

    const match = candidates.find((p) => p.tenantId === tenant.id);
    if (!match) {
      throw new NotFoundException(
        'No account found for this email at the given school',
      );
    }
    return match;
  }

  private async issueTokenPair(
    parent: Parent,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: ParentJwtPayload = {
      sub: parent.id,
      email: parent.email,
      role: Role.PARENT,
      tenantId: parent.tenantId,
      branch: null,
      name: parent.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: Number(this.configService.get('jwt.expiresIn')) || 86400,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: Number(this.configService.get('jwt.refreshExpiresIn')) || 604800,
    });

    const hash = await bcrypt.hash(refreshToken, 10);
    await this.parentsService.updateRefreshToken(parent.id, hash);

    return { accessToken, refreshToken };
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async sendOtpEmail(
    email: string,
    name: string,
    otp: string,
  ): Promise<void> {
    const smtpUser = this.configService.get<string>('smtp.user');
    const smtpHost = this.configService.get<string>('smtp.host');
    const demoMode = this.configService.get<boolean>('demoMode');

    if (demoMode || !smtpUser || !smtpHost) {
      this.logger.warn(
        `[OTP] ${email} → ${otp}  (demo / no SMTP — email not sent)`,
      );
      return;
    }

    const port = this.configService.get<number>('smtp.port') ?? 587;
    const secure = port === 465;

    const transporterOptions: Record<string, any> = {
      host: smtpHost,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: smtpUser, pass: this.configService.get<string>('smtp.pass') },
    };

    if (this.configService.get<boolean>('smtp.allowInsecure')) {
      transporterOptions.tls = { rejectUnauthorized: false };
    }

    const expiresInMinutes =
      this.configService.get<number>('otp.expiresInMinutes') ?? 5;

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a3c8f">Sri Venkateswara Bala Kuteer</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your one-time password for the Parent Portal is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                    padding:16px;background:#f0f4ff;border-radius:8px;color:#1a3c8f">
          ${otp}
        </div>
        <p style="color:#888;font-size:13px">
          This OTP is valid for ${expiresInMinutes} minutes. Do not share it with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#aaa;font-size:12px">
          © ${new Date().getFullYear()} Sri Venkateswara Bala Kuteer. All rights reserved.
        </p>
      </div>
    `;

    try {
      const transporter = nodemailer.createTransport(transporterOptions);
      await transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to: email,
        subject: 'Your SVBK Parent Portal OTP',
        html,
      });
      this.logger.log(`[OTP] Email sent to ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[OTP] Failed to send email to ${email}: ${message}`);
      throw new Error('Could not send OTP email. Check SMTP configuration.');
    }
  }
}
