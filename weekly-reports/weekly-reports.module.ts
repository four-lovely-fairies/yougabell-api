import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsService } from './weekly-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [WeeklyReportsController],
  providers: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
