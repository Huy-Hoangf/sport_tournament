import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { SportsSyncModule } from '../integrations/sports-sync.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, SportsSyncModule, TypeOrmModule.forFeature([User])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
