import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { GenerateWeeklyReportsDto } from '../admin/dto/generate-weekly-reports.dto';
import { WeeklyReportsService } from './weekly-reports.service';

@ApiExcludeController()
@Controller('internal/weekly-reports')
@SkipOnboardingCheck()
export class WeeklyReportsInternalController {
  constructor(private readonly weeklyReportsService: WeeklyReportsService) {}

  @Post('generate')
  generateWeeklyReports(
    @Headers('x-cron-secret') cronSecret: string | undefined,
    @Body() body: GenerateWeeklyReportsDto,
  ) {
    const expectedSecret = process.env.WEEKLY_REPORT_CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException({
        code: 'INVALID_CRON_SECRET',
        message: 'Invalid cron secret.',
      });
    }

    return this.weeklyReportsService.generateForWeek({
      weekStart: body.weekStart,
      ...(body.forceRegenerate === undefined
        ? {}
        : { forceRegenerate: body.forceRegenerate }),
      ...(body.dryRun === undefined ? {} : { dryRun: body.dryRun }),
    });
  }
}
