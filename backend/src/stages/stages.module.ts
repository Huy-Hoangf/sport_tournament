import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [StagesController],
  providers: [StagesService],
})
export class StagesModule {}
