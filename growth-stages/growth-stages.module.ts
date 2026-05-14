import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GrowthStagesController } from './growth-stages.controller';
import { GrowthStagesService } from './growth-stages.service';

@Module({
  imports: [AuthModule],
  controllers: [GrowthStagesController],
  providers: [GrowthStagesService],
})
export class GrowthStagesModule {}
