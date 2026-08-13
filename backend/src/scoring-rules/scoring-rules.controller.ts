import { Body, Controller, Get, Headers, Put, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ScoringRulesService } from './scoring-rules.service';

@Controller('scoring-rules')
export class ScoringRulesController {
  constructor(
    private readonly scoringRulesService: ScoringRulesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findByTournament(
    @Headers('authorization') authorization: string | undefined,
    @Query('tournamentId') tournamentId: string,
  ) {
    await this.authService.verifyAccessToken(authorization);
    return this.scoringRulesService.findByTournament(Number(tournamentId));
  }

  @Put()
  async replaceTournamentRules(
    @Headers('authorization') authorization: string | undefined,
    @Query('tournamentId') tournamentId: string,
    @Body() body: { rules: unknown[] },
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.scoringRulesService.replaceTournamentRules(
      Number(tournamentId),
      body.rules as never[],
    );
  }
}
