import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.login(body.email, body.password);

    return {
      message: 'Login successful.',
      user,
    };
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.verifyForgotPasswordEmail(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { email: string; newPassword: string }) {
    return this.authService.resetAdminPassword(body.email, body.newPassword);
  }
}
