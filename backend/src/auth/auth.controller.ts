import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.login(body.email, body.password);

    return {
      message: 'Login successful.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken: user.accessToken,
      requiresPasswordChange: user.requiresPasswordChange,
    };
  }

  @Post('complete-first-login')
  completeFirstLogin(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { newPassword: string },
  ) {
    return this.authService.completeFirstLogin(authorization, body.newPassword);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.verifyForgotPasswordEmail(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { email: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.newPassword);
  }

  @Post('change-password')
  changePassword(
    @Body()
    body: {
      email: string;
      currentPassword: string;
      newPassword: string;
    },
  ) {
    return this.authService.changePassword(
      body.email,
      body.currentPassword,
      body.newPassword,
    );
  }
}
