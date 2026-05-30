import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { NotificationsInternalController } from './notifications.internal.controller';

void describe('NotificationsInternalController', () => {
  void it('rejects requests with a missing or invalid cron secret', () => {
    const controller = new NotificationsInternalController({
      dispatchPlayReminders: () =>
        Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
      dispatchWeeklyReportNotifications: () =>
        Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
    } as never);

    assert.throws(
      () => controller.dispatchPlayReminders('wrong-secret', {}),
      UnauthorizedException,
    );
  });

  void it('dispatches weekly report notifications with a valid cron secret', async () => {
    process.env.NOTIFICATION_CRON_SECRET = 'secret-123';
    const calls: unknown[] = [];
    const controller = new NotificationsInternalController({
      dispatchPlayReminders: () =>
        Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
      dispatchWeeklyReportNotifications: (input: unknown) => {
        calls.push(input);
        return Promise.resolve({ processed: 1, generated: 1, skipped: 0 });
      },
    } as never);

    const result = await controller.dispatchWeeklyReportNotifications(
      'secret-123',
      {
        now: '2026-06-01T12:00:00+09:00',
        dryRun: true,
      },
    );

    assert.deepEqual(calls, [
      { now: '2026-06-01T12:00:00+09:00', dryRun: true },
    ]);
    assert.deepEqual(result, { processed: 1, generated: 1, skipped: 0 });
    delete process.env.NOTIFICATION_CRON_SECRET;
  });
});
