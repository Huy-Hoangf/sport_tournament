import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { positiveId } from '../matches/match-validation';
import { PredictionsService } from './predictions.service';

@Controller('predictions')
export class PredictionsController {
  constructor(
    private readonly predictions: PredictionsService,
    private readonly auth: AuthService,
  ) {}

  @Put(':matchId')
  async vote(
    @Headers('authorization') authorization: string | undefined,
    @Param('matchId') matchId: string,
    @Body() input: Record<string, unknown>,
  ) {
    const user = await this.auth.verifyAccessToken(authorization);
    if (user.role !== 'PLAYER')
      throw new ForbiddenException('Only players can vote.');
    return this.predictions.vote(user.sub, positiveId(matchId), input ?? {});
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, string>,
  ) {
    const user = await this.auth.verifyAccessToken(authorization);
    return this.predictions.list(
      user.sub,
      ['ADMIN', 'SUPER_ADMIN'].includes(user.role),
      query.tournamentId ? positiveId(query.tournamentId) : undefined,
      query.matchId ? positiveId(query.matchId) : undefined,
      query.page ? positiveId(query.page) : 1,
    );
  }
}
