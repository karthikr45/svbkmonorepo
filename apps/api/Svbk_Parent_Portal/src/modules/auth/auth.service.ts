import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { LessThan, Repository } from 'typeorm';
import { ParentsService } from '../parents/parents.service';
import { Otp } from './entities/otp.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,
    private readonly parentsService: ParentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(email: string) {
    const parent = await this.parentsService.findByEmail(email);
    if (!parent) {
      throw new NotFoundException('No account found with this email address');
    }

    await this.otpRepo.update({ email, isUsed: false }, { isUsed: true });

    const rawOtp = this.generateOtp();
    const hash = await bcrypt.hash(rawOtp, 10);
    const expiresInMinutes = this.configService.get('otp.expiresInMinutes') || 2;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.otpRepo.save({ email, otpHash: hash, expiresAt, isUsed: false });
    await this.sendOtpEmail(email, parent.name, rawOtp);

    return { message: 'OTP sent successfully. Please check your email.' };
  }

  async verifyOtp(email: string, otp: string) {
    const parent = await this.parentsService.findByEmail(email);
    if (!parent) {
      throw new NotFoundException('No account found with this email address');
    }

    const demoMode = this.configService.get('demoMode');
    if (!demoMode) {
      const otpRecord = await this.otpRepo.findOne({
        where: { email, isUsed: false },
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

    const tokens = await this.issueTokenPair(parent.id, parent.email, parent.name);
    return {
      ...tokens,
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const parent = await this.parentsService.findById(payload.sub);
    if (!parent?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isMatch = await bcrypt.compare(refreshToken, parent.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokenPair(parent.id, parent.email, parent.name);
  }

  async logout(parentId: string) {
    await this.parentsService.updateRefreshToken(parentId, null);
  }

  private async issueTokenPair(id: string, email: string, name: string) {
    const payload = { sub: id, email, name };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn') || '15m',
    });

    const newRefreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn') || '7d',
    });

    const hash = await bcrypt.hash(newRefreshToken, 10);
    await this.parentsService.updateRefreshToken(id, hash);

    return { accessToken, refreshToken: newRefreshToken };
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async sendOtpEmail(email: string, name: string, otp: string) {
    const smtpUser = this.configService.get('smtp.user');
    const demoMode = this.configService.get('demoMode');

    if (demoMode || !smtpUser) {
      this.logger.log(`[OTP] ${email} → ${otp}  (demo mode – email not sent)`);
      return;
    }

    const smtpPort = this.configService.get('smtp.port') || 587;
    const secure = smtpPort === 465;

    const transporterOptions: any = {
      host: this.configService.get('smtp.host'),
      port: smtpPort,
      secure,
      requireTLS: !secure,
      auth: {
        user: smtpUser,
        pass: this.configService.get('smtp.pass'),
      },
    };

    if (
      this.configService.get('smtp.allowInsecure') ||
      process.env.SMTP_ALLOW_INSECURE === 'true'
    ) {
      transporterOptions.tls = { rejectUnauthorized: false };
    }

    const transporter = nodemailer.createTransport(transporterOptions);

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
          This OTP is valid for ${this.configService.get('otp.expiresInMinutes')} minutes.
          Do not share it with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#aaa;font-size:12px">
          © ${new Date().getFullYear()} Sri Venkateswara Bala Kuteer. All rights reserved.
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: this.configService.get('smtp.from'),
        to: email,
        subject: 'Your SVBK Parent Portal OTP',
        html,
      });
      this.logger.log(`[OTP] Email sent to ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[OTP] Failed to send email to ${email}: ${message}`);
      throw new Error(`Could not send OTP email. Check SMTP configuration.`);
    }
  }

  async cleanExpiredOtps() {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}
