import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MilestoneCategoriesController } from './milestone-categories.controller';
import { MilestoneCategoriesService } from './milestone-categories.service';

@Module({
  imports: [AuthModule],
  controllers: [MilestoneCategoriesController],
  providers: [MilestoneCategoriesService],
})
export class MilestoneCategoriesModule {}
