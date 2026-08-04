import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await this.authService.verifyAccessToken(authorization);
    const includePrivateTournaments = ['SUPER_ADMIN', 'ADMIN'].includes(
      user.role,
    );

    return this.tournamentsService.findAll({
      includePrivateTournaments,
    });
  }

  @Post('admin')
  async createTournament(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      name: string;
      sportType?: string;
      format?: string;
      status?: string;
      visibility?: string;
    },
  ) {
    const admin = await this.authService.verifyAdminToken(authorization);
    return this.tournamentsService.createTournamentByAdmin(admin.sub, body);
  }

  @Patch('admin/:id')
  async updateTournament(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      sportType?: string;
      format?: string;
      status?: string;
      visibility?: string;
    },
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.tournamentsService.updateTournamentByAdmin(Number(id), body);
  }

  @Delete('admin/:id')
  async deleteTournament(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.tournamentsService.deleteTournamentByAdmin(Number(id));
  }
}
