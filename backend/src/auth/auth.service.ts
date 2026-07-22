import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import {
  ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
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

  verifyForgotPasswordEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);

    if (!isTwentyTechEmail(normalizedEmail)) {
      throw new BadRequestException('Email must use @twenty-tech.com.');
    }

    if (normalizedEmail !== ADMIN_EMAIL) {
      throw new BadRequestException('Only the admin account can use this flow.');
    }

    return {
      message: 'Admin email verified.',
      email: normalizedEmail,
    };
  }

  async resetAdminPassword(email: string, newPassword: string) {
    const normalizedEmail = normalizeEmail(email);

    this.verifyForgotPasswordEmail(normalizedEmail);

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
      throw new BadRequestException(
        `Admin user does not exist. Seed ${ADMIN_EMAIL} with default password ${DEFAULT_ADMIN_PASSWORD}.`,
      );
    }

    return {
      message: 'Admin password reset successfully.',
    };
  }
}
