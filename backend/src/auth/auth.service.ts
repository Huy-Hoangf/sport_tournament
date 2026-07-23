import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import {
  ADMIN_EMAIL,
  isTwentyTechEmail,
  normalizeEmail,
} from './auth.constants';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

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

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: normalizedEmail === ADMIN_EMAIL ? 'ADMIN' : user.role,
    };
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
