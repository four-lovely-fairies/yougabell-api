import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MissionFlowController } from './mission-flow.controller';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [AuthModule],
  controllers: [MissionsController, MissionFlowController],
  providers: [MissionsService],
})
export class MissionsModule {}
