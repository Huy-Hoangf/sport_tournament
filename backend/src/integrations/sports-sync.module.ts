import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SportsApiSyncService } from './sports-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [SportsApiSyncService],
  exports: [SportsApiSyncService],
})
export class SportsSyncModule {}
