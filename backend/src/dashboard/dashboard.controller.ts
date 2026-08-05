import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';
import { SportsApiSyncService } from './sports-api-sync.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly sportsApiSyncService: SportsApiSyncService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getDashboard(
    @Headers('authorization') authorization: string | undefined,
    @Query('scope') scope: string | undefined,
  ) {
    const user = await this.authService.verifyAccessToken(authorization);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

    return this.dashboardService.getDashboard({
      includeAttentionDetails: isAdmin,
      includePrivateTournaments: isAdmin,
      scope: scope === 'all' ? 'all' : 'today',
    });
  }

  @Post('sync')
  async syncNow(@Headers('authorization') authorization: string | undefined) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.syncAllNow();
  }

  @Delete('api-data')
  async deleteApiData(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.deleteImportedApiData();
  }

  @Post('sync/football')
  async syncFootballNow(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.syncFootballNow();
  }

  @Post('sync/f1')
  async syncF1Now(@Headers('authorization') authorization: string | undefined) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.syncF1Now();
  }

  @Get('football-competitions')
  async getFootballCompetitions(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.listFootballCompetitions();
  }

  @Post('sync-football')
  async syncFootballCompetitions(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      leagues?: Array<{
        id: number;
        season: number;
        name?: string;
        start?: string | null;
        end?: string | null;
        current?: boolean;
      }>;
    },
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.syncSelectedFootballLeagues(
      body.leagues ?? [],
    );
  }

  @Get('f1-meetings')
  async getF1Meetings(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.listF1Meetings();
  }

  @Post('sync-f1')
  async syncF1Meetings(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { meetingKeys?: number[] },
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.syncSelectedF1Meetings(
      body.meetingKeys ?? [],
    );
  }

  @Get('lol-competitions')
  async getLolCompetitions(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.verifyAdminToken(authorization);
    try {
      return await this.sportsApiSyncService.listLolCompetitions();
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Cannot load LoL competitions.',
      );
    }
  }

  @Post('sync-lol')
  async syncLolCompetitions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { competitionIds?: string[] },
  ) {
    await this.authService.verifyAdminToken(authorization);
    try {
      return await this.sportsApiSyncService.syncSelectedLolCompetitions(
        body.competitionIds ?? [],
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'LoL import failed.',
      );
    }
  }
}
