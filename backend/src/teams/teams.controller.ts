import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(
    @Headers('authorization') authorization: string | undefined,
    @Query('tournamentId') tournamentId?: string,
  ) {
    const user = await this.authService.verifyAccessToken(authorization);
    const includePrivateTournaments = ['SUPER_ADMIN', 'ADMIN'].includes(
      user.role,
    );

    return this.teamsService.findAll({
      includePrivateTournaments,
      tournamentId: tournamentId ? Number(tournamentId) : undefined,
    });
  }
}
