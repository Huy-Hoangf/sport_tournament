import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { ScoringRulesController } from './scoring-rules.controller';
import { ScoringRulesService } from './scoring-rules.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [ScoringRulesController],
  providers: [ScoringRulesService],
})
export class ScoringRulesModule {}
