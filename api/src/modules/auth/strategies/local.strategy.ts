import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { AdminsService } from '../../admins/admins.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly usersService: UsersService,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    // Check admins table first
    const admin = await this.adminsService.findByEmail(email);
    if (admin && admin.isActive) {
      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (isMatch) {
        return { ...admin, _source: 'admin' };
      }
    }

    // Fallback to users table
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive && user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (isMatch) {
        return { ...user, _source: 'user' };
      }
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}
