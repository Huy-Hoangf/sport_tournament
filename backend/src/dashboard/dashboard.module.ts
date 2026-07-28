import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SportsApiSyncService } from './sports-api-sync.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [DashboardController],
  providers: [DashboardService, SportsApiSyncService],
})
export class DashboardModule {}
