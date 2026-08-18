import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
