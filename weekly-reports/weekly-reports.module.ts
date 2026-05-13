import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsInternalController } from './weekly-reports.internal.controller';
import { WeeklyReportsService } from './weekly-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [WeeklyReportsController, WeeklyReportsInternalController],
  providers: [WeeklyReportsService],
  exports: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
