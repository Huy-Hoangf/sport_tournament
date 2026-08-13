import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(@Headers('authorization') authorization: string | undefined) {
    await this.authService.verifyAdminToken(authorization);
    return this.usersService.findAll();
  }

  @Post('admin/create')
  async createPlayerByAdmin(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: { email: string; fullName: string; role?: 'ADMIN' | 'PLAYER' },
  ) {
    const admin = await this.authService.verifyAdminToken(authorization);
    const user = await this.usersService.createPlayerByAdmin(body, admin.role);

    return {
      message: 'User created successfully.',
      user,
    };
  }

  @Patch('admin/:id/rename')
  async renamePlayerByAdmin(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body()
    body: {
      email: string;
      fullName: string;
      role?: 'ADMIN' | 'PLAYER';
    },
  ) {
    const admin = await this.authService.verifyAdminToken(authorization);
    const user = await this.usersService.renamePlayerByAdmin({
      id: Number(id),
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      actorId: admin.sub,
      actorRole: admin.role,
    });

    return {
      message: 'User updated successfully.',
      user,
    };
  }

  @Patch('admin/:id/status')
  async updatePlayerStatusByAdmin(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'PENDING' },
  ) {
    await this.authService.verifyAdminToken(authorization);
    const user = await this.usersService.updatePlayerStatusByAdmin(
      Number(id),
      body.status,
    );

    return {
      message: 'User status updated successfully.',
      user,
    };
  }

  @Delete('admin/all')
  async deleteAllPlayersByAdmin(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.verifySuperAdminToken(authorization);
    return this.usersService.deleteAllPlayersByAdmin();
  }

  @Delete('admin/:id')
  async deletePlayerByAdmin(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.usersService.deletePlayerByAdmin(Number(id));
  }
}
