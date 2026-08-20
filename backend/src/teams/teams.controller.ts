import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
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

  @Get(':teamId')
  async findOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('teamId') teamId: string,
  ) {
    const user = await this.authService.verifyAccessToken(authorization);
    const includePrivateTournaments = ['SUPER_ADMIN', 'ADMIN'].includes(
      user.role,
    );

    return this.teamsService.findOne({
      includePrivateTournaments,
      teamId: Number(teamId),
    });
  }

  @Post('register')
  async registerTeam(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      tournamentId?: number;
      teamName?: string;
      players?: Array<{ name?: string }>;
    },
  ) {
    await this.authService.verifyAdminToken(authorization);

    return this.teamsService.registerTeam({
      tournamentId: Number(body.tournamentId),
      teamName: body.teamName ?? '',
      players: body.players ?? [],
    });
  }

  @Put(':teamId')
  async updateTeam(
    @Headers('authorization') authorization: string | undefined,
    @Param('teamId') teamId: string,
    @Body()
    body: {
      teamName?: string;
      players?: Array<{ name?: string }>;
    },
  ) {
    await this.authService.verifyAdminToken(authorization);

    return this.teamsService.updateTeam({
      teamId: Number(teamId),
      teamName: body.teamName ?? '',
      players: body.players ?? [],
    });
  }

  @Delete(':teamId')
  async deleteTeam(
    @Headers('authorization') authorization: string | undefined,
    @Param('teamId') teamId: string,
  ) {
    await this.authService.verifyAdminToken(authorization);

    return this.teamsService.deleteTeam({
      teamId: Number(teamId),
    });
  }
}
