import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import {
  ADMIN_EMAIL,
  isTwentyTechEmail,
  normalizeEmail,
} from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    if (!isTwentyTechEmail(normalizedEmail)) {
      throw new BadRequestException('Email must use @twenty-tech.com.');
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
      role: normalizedEmail === ADMIN_EMAIL ? 'ADMIN' : user.role,
    };

    return {
      ...responseUser,
      accessToken: await this.jwtService.signAsync({
        sub: responseUser.id,
        email: responseUser.email,
        role: responseUser.role,
      }),
    };
  }

  async verifyAdminToken(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
        role: string;
      }>(token);

      if (payload.role !== 'ADMIN') {
        throw new ForbiddenException('Only admin can perform this action.');
      }

      return payload;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }

  async verifyForgotPasswordEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);

    if (!isTwentyTechEmail(normalizedEmail)) {
      throw new BadRequestException('Email must use @twenty-tech.com.');
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

    if (!isTwentyTechEmail(normalizedEmail)) {
      throw new BadRequestException('Email must use @twenty-tech.com.');
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
}
