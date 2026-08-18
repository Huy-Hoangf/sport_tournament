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
  DEFAULT_PLAYER_PASSWORD,
  isValidEmail,
  normalizeEmail,
} from './auth.constants';

type AccessTokenPayload = {
  sub: number;
  email: string;
  role: UserRole;
  purpose?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Invalid email address.');
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

  getGoogleLoginUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL?.trim() ??
      'http://localhost:3001/auth/google/callback';

    if (!clientId) {
      throw new BadRequestException('Google login is not configured.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code?: string, error?: string) {
    const frontendUrl = this.getFrontendUrl();

    if (error) {
      return this.buildGoogleRedirect(frontendUrl, {
        error: `Google login failed: ${error}`,
      });
    }

    if (!code) {
      return this.buildGoogleRedirect(frontendUrl, {
        error: 'Google login failed: missing authorization code.',
      });
    }

    try {
      const googleUser = await this.fetchGoogleUser(code);

      if (!googleUser.email_verified) {
        return this.buildGoogleRedirect(frontendUrl, {
          error: 'Google email is not verified.',
        });
      }

      const normalizedEmail = normalizeEmail(googleUser.email);

      if (!isValidEmail(normalizedEmail)) {
        return this.buildGoogleRedirect(frontendUrl, {
          error: 'Google account did not return a valid email.',
        });
      }

      const user = await this.usersService.upsertGoogleUser({
        email: normalizedEmail,
        fullName: googleUser.name?.trim() || normalizedEmail.split('@')[0],
        googleId: googleUser.sub,
        avatarUrl: googleUser.picture ?? null,
      });
      const responseUser = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.email === ADMIN_EMAIL ? 'SUPER_ADMIN' : user.role,
      };
      const accessToken = await this.signAccessToken(responseUser);

      return this.buildGoogleRedirect(frontendUrl, {
        accessToken,
        user: JSON.stringify(responseUser),
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Google login failed.';

      return this.buildGoogleRedirect(frontendUrl, { error: message });
    }
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

    if (!isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Invalid email address.');
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

    if (!isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Invalid email address.');
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

  private signAccessToken(user: { id: number; email: string; role: UserRole }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async fetchGoogleUser(code: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL?.trim() ??
      'http://localhost:3001/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google login is not configured.');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ??
          tokenData.error ??
          'Cannot exchange Google authorization code.',
      );
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );
    const profileData = (await profileResponse.json()) as GoogleUserInfo;

    if (!profileResponse.ok || !profileData.sub || !profileData.email) {
      throw new Error('Cannot load Google account profile.');
    }

    return profileData;
  }

  private getFrontendUrl() {
    return process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  }

  private buildGoogleRedirect(
    frontendUrl: string,
    data: { accessToken?: string; user?: string; error?: string },
  ) {
    const params = new URLSearchParams();

    if (data.accessToken) {
      params.set('accessToken', data.accessToken);
    }

    if (data.user) {
      params.set('user', data.user);
    }

    if (data.error) {
      params.set('error', data.error);
    }

    return `${frontendUrl.replace(/\/$/, '')}/login#google=${encodeURIComponent(
      params.toString(),
    )}`;
  }
}
