import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post('admin/create')
  async createPlayerByAdmin(
    @Body() body: { email: string; fullName: string },
  ) {
    const user = await this.usersService.createPlayerByAdmin(body);

    return {
      message: 'User created successfully.',
      user,
    };
  }
}
