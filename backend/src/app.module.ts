import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { StagesModule } from './stages/stages.module';
import { TeamsModule } from './teams/teams.module';
import { MatchesModule } from './matches/matches.module';
import { PredictionsModule } from './predictions/predictions.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { DashboardModule } from './dashboard/dashboard.module';

function readSslConfig() {
  return process.env.DB_SSL === 'false'
    ? false
    : { rejectUnauthorized: false };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      ssl: readSslConfig(),
    }),

    AuthModule,
    UsersModule,
    TournamentsModule,
    StagesModule,
    TeamsModule,
    MatchesModule,
    PredictionsModule,
    LeaderboardModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
