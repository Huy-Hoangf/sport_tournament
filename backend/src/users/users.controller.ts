import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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

  @Patch('admin/:id/rename')
  async renamePlayerByAdmin(
    @Param('id') id: string,
    @Body() body: { email: string; fullName: string },
  ) {
    const user = await this.usersService.renamePlayerByAdmin({
      id: Number(id),
      email: body.email,
      fullName: body.fullName,
    });

    return {
      message: 'User updated successfully.',
      user,
    };
  }

  @Delete('admin/:id')
  deletePlayerByAdmin(@Param('id') id: string) {
    return this.usersService.deletePlayerByAdmin(Number(id));
  }
}
