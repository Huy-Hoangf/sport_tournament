import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
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
  getDashboard() {
    return this.dashboardService.getDashboard();
  }

  @Post('sync')
  async syncNow(@Headers('authorization') authorization: string | undefined) {
    await this.authService.verifyAdminToken(authorization);
    return this.sportsApiSyncService.syncIfStale(true);
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
    body: { leagues?: Array<{ id: number; season: number; name?: string }> },
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
}
