import { Module } from '@nestjs/common';
import { WeeklyReportsModule } from '../weekly-reports/weekly-reports.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [WeeklyReportsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
