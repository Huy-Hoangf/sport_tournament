import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { StagesService } from './stages.service';

@Controller('stages')
export class StagesController {
  constructor(
    private readonly stagesService: StagesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findByTournament(
    @Headers('authorization') authorization: string | undefined,
    @Query('tournamentId') tournamentId: string,
  ) {
    await this.authService.verifyAccessToken(authorization);
    return this.stagesService.findByTournament(Number(tournamentId));
  }
}
