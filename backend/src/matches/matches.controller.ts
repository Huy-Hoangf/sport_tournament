import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(
    @Headers('authorization') authorization: string | undefined,
    @Query('tournamentId') tournamentId?: string,
    @Query('stageId') stageId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const user = await this.authService.verifyAccessToken(authorization);
    const includePrivateTournaments = ['SUPER_ADMIN', 'ADMIN'].includes(
      user.role,
    );

    return this.matchesService.findAll({
      includePrivateTournaments,
      tournamentId: tournamentId ? Number(tournamentId) : undefined,
      stageId: stageId ? Number(stageId) : undefined,
      status,
      search,
    });
  }
}
