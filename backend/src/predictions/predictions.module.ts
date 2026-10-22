import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [PredictionsController],
  providers: [PredictionsService],
})
export class PredictionsModule {}
