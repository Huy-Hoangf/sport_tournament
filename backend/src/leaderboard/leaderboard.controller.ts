import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { positiveId } from '../matches/match-validation';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query('tournamentId') tournamentId?: string,
  ) {
    const user = await this.auth.verifyAccessToken(authorization);
    return this.leaderboard.list(
      tournamentId ? positiveId(tournamentId) : undefined,
      ['ADMIN', 'SUPER_ADMIN'].includes(user.role),
    );
  }
}
