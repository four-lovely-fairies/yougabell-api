import { generateText } from 'ai';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsInternalController } from './weekly-reports.internal.controller';
import {
  WeeklyReportsService,
  WEEKLY_REPORT_GENERATE_TEXT,
} from './weekly-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [WeeklyReportsController, WeeklyReportsInternalController],
  providers: [
    WeeklyReportsService,
    {
      provide: WEEKLY_REPORT_GENERATE_TEXT,
      useValue: generateText,
    },
  ],
  exports: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
