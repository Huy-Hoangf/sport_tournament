import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import {
  ADMIN_EMAIL,
  COMPANY_EMAIL_DOMAIN,
  DEFAULT_PLAYER_PASSWORD,
  isCompanyEmail,
  normalizeEmail,
} from './auth.constants';

type AccessTokenPayload = {
  sub: number;
  email: string;
  role: UserRole;
  purpose?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    if (!isCompanyEmail(normalizedEmail)) {
      throw new BadRequestException(`Email must use ${COMPANY_EMAIL_DOMAIN}.`);
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatched = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const responseUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: normalizedEmail === ADMIN_EMAIL ? 'SUPER_ADMIN' : user.role,
    };
    const requiresPasswordChange =
      responseUser.role === 'PLAYER' && password === DEFAULT_PLAYER_PASSWORD;

    return {
      ...responseUser,
      requiresPasswordChange,
      accessToken: requiresPasswordChange
        ? await this.jwtService.signAsync(
            {
              sub: responseUser.id,
              email: responseUser.email,
              role: responseUser.role,
              purpose: 'PASSWORD_CHANGE',
            },
            { expiresIn: '15m' },
          )
        : await this.signAccessToken(responseUser),
    };
  }

  async completeFirstLogin(
    authorization: string | undefined,
    newPassword: string,
  ) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

    if (!token) {
      throw new UnauthorizedException('Missing password change token.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'Password must contain at least 6 characters.',
      );
    }

    if (newPassword === DEFAULT_PLAYER_PASSWORD) {
      throw new BadRequestException(
        'New password must be different from the default password.',
      );
    }

    let payload: {
      sub: number;
      email: string;
      role: UserRole;
      purpose?: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired password change token.',
      );
    }

    if (payload.role !== 'PLAYER' || payload.purpose !== 'PASSWORD_CHANGE') {
      throw new ForbiddenException('This token cannot change the password.');
    }

    const user = await this.usersService.findByEmail(payload.email);

    if (
      !user ||
      !user.passwordHash ||
      user.id !== payload.sub ||
      user.role !== 'PLAYER'
    ) {
      throw new UnauthorizedException('Invalid player account.');
    }

    const stillUsesDefaultPassword = await bcrypt.compare(
      DEFAULT_PLAYER_PASSWORD,
      user.passwordHash,
    );

    if (!stillUsesDefaultPassword) {
      throw new BadRequestException('Password has already been changed.');
    }

    await this.usersService.updatePassword(user.email, newPassword);

    const responseUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    return {
      message: 'Password changed successfully.',
      user: responseUser,
      accessToken: await this.signAccessToken(responseUser),
    };
  }

  async verifyAccessToken(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (payload.purpose) {
        throw new UnauthorizedException(
          'This token cannot access the application.',
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }

  async verifyAdminToken(authorization?: string) {
    const payload = await this.verifyAccessToken(authorization);

    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      throw new ForbiddenException('Only admin can perform this action.');
    }

    return payload;
  }

  async verifySuperAdminToken(authorization?: string) {
    const payload = await this.verifyAccessToken(authorization);

    if (payload.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only the super admin can perform this action.',
      );
    }

    return payload;
  }

  async verifyForgotPasswordEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);

    if (!isCompanyEmail(normalizedEmail)) {
      throw new BadRequestException(`Email must use ${COMPANY_EMAIL_DOMAIN}.`);
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new BadRequestException('Account does not exist.');
    }

    return {
      message: 'Email verified.',
      email: normalizedEmail,
    };
  }

  async resetPassword(email: string, newPassword: string) {
    const normalizedEmail = normalizeEmail(email);

    await this.verifyForgotPasswordEmail(normalizedEmail);

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'Password must contain at least 6 characters.',
      );
    }

    const updatedUser = await this.usersService.updatePassword(
      normalizedEmail,
      newPassword,
    );

    if (!updatedUser) {
      throw new BadRequestException('Account does not exist.');
    }

    return {
      message: 'Password reset successfully.',
    };
  }

  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const normalizedEmail = normalizeEmail(email);

    if (!isCompanyEmail(normalizedEmail)) {
      throw new BadRequestException(`Email must use ${COMPANY_EMAIL_DOMAIN}.`);
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'Password must contain at least 6 characters.',
      );
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid user.');
    }

    const passwordMatched = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.usersService.updatePassword(normalizedEmail, newPassword);

    return {
      message: 'Password changed successfully.',
    };
  }

  private signAccessToken(user: {
    id: number;
    email: string;
    role: UserRole;
  }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
