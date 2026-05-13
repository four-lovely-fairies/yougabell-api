import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { WeeklyReportsInternalController } from './weekly-reports.internal.controller';

void describe('WeeklyReportsInternalController', () => {
  void it('rejects requests with a missing or invalid cron secret', async () => {
    const controller = new WeeklyReportsInternalController({
      generateForWeek: () =>
        Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
    } as unknown as ConstructorParameters<
      typeof WeeklyReportsInternalController
    >[0]);

    assert.throws(
      () => controller.generateWeeklyReports('wrong-secret', {}),
      UnauthorizedException,
    );
  });

  void it('runs weekly report generation with a valid cron secret', async () => {
    process.env.WEEKLY_REPORT_CRON_SECRET = 'secret-123';
    const calls: unknown[] = [];
    const controller = new WeeklyReportsInternalController({
      generateForWeek: (input: unknown) => {
        calls.push(input);
        return Promise.resolve({ processed: 1, generated: 1, skipped: 0 });
      },
    } as unknown as ConstructorParameters<
      typeof WeeklyReportsInternalController
    >[0]);

    const result = await controller.generateWeeklyReports('secret-123', {
      weekStart: '2026-05-04',
      dryRun: true,
    });

    assert.deepEqual(calls, [{ weekStart: '2026-05-04', dryRun: true }]);
    assert.deepEqual(result, { processed: 1, generated: 1, skipped: 0 });
    delete process.env.WEEKLY_REPORT_CRON_SECRET;
  });
});
