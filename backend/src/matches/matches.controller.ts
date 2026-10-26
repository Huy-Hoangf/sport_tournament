import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { MatchesService } from './matches.service';
import { positiveId } from './match-validation';
import { matchTemplate } from './match-workbook';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly authService: AuthService,
  ) {}

  @Get('template')
  async template(@Headers('authorization') authorization?: string) {
    await this.authService.verifyAdminToken(authorization);
    return new StreamableFile(await matchTemplate(), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="matches-template.xlsx"',
    });
  }

  @Get('page')
  async page(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, string>,
  ) {
    const user = await this.authService.verifyAccessToken(authorization);
    const page = positiveId(query.page ?? '1', 'page');
    const pageSize = positiveId(query.pageSize ?? '20', 'pageSize');
    if (pageSize > 100 || (query.search?.length ?? 0) > 200)
      throw new BadRequestException('Invalid pagination/search.');
    if (
      query.status &&
      !['ALL', 'PENDING', 'LIVE', 'FINISHED', 'CANCELLED'].includes(
        query.status,
      )
    )
      throw new BadRequestException('Invalid status.');
    if (query.openForVoting && query.openForVoting !== 'true')
      throw new BadRequestException('Invalid openForVoting filter.');
    const items = await this.matchesService.findAll({
      includePrivateTournaments: ['ADMIN', 'SUPER_ADMIN'].includes(user.role),
      tournamentId: query.tournamentId
        ? positiveId(query.tournamentId)
        : undefined,
      stageId: query.stageId ? positiveId(query.stageId) : undefined,
      status: query.status,
      openForVoting: query.openForVoting === 'true',
      search: query.search,
      page,
      pageSize,
    });
    return { items, total: items[0]?.totalCount ?? 0, page, pageSize };
  }

  @Post('import')
  async import(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.matchesService.importWorkbook(body ?? {});
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.matchesService.create(body ?? {});
  }

  @Put(':id/prediction-lock')
  async lock(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: { locked?: unknown },
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.matchesService.setPredictionLock(positiveId(id), body?.locked);
  }

  @Put(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.matchesService.update(positiveId(id), body ?? {});
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.authService.verifyAdminToken(authorization);
    return this.matchesService.remove(positiveId(id));
  }

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
