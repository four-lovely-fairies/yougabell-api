import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { NotificationsInternalController } from './notifications.internal.controller';

void describe('NotificationsInternalController', () => {
  void it('rejects requests with a missing or invalid cron secret', () => {
    const controller = new NotificationsInternalController(
      {
        dispatchPlayReminders: () =>
          Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
        dispatchWeeklyReportNotifications: () =>
          Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
      } as never,
      {} as never,
    );

    assert.throws(
      () => controller.dispatchPlayReminders('wrong-secret', {}),
      UnauthorizedException,
    );
  });

  void it('force-sends a diagnostic push with a valid cron secret', async () => {
    process.env.NOTIFICATION_CRON_SECRET = 'secret-123';
    const calls: unknown[] = [];
    const controller = new NotificationsInternalController(
      {} as never,
      {
        sendToUserDetailed: (input: unknown) => {
          calls.push(input);
          return Promise.resolve({
            attempted: 1,
            sent: 0,
            failed: 1,
            tickets: [
              {
                token: 'ExponentPushToken[dead]',
                status: 'error',
                error: 'DeviceNotRegistered',
              },
            ],
          });
        },
      } as never,
    );

    const result = await controller.sendTest('secret-123', {
      userId: '00000000-0000-0000-0000-000000000000',
    });

    assert.deepEqual(calls, [
      {
        userId: '00000000-0000-0000-0000-000000000000',
        title: '육아벨 테스트 알림',
        body: '푸시 알림이 정상 동작하는지 확인하는 테스트입니다.',
        data: { actionType: 'open_home' },
      },
    ]);
    assert.equal(result.attempted, 1);
    assert.equal(result.sent, 0);
    delete process.env.NOTIFICATION_CRON_SECRET;
  });

  void it('rejects send-test with an invalid cron secret', () => {
    const controller = new NotificationsInternalController(
      {} as never,
      {
        sendToUserDetailed: () => Promise.resolve({}),
      } as never,
    );

    assert.throws(
      () =>
        controller.sendTest('wrong-secret', {
          userId: '00000000-0000-0000-0000-000000000000',
        }),
      UnauthorizedException,
    );
  });

  void it('dispatches weekly report notifications with a valid cron secret', async () => {
    process.env.NOTIFICATION_CRON_SECRET = 'secret-123';
    const calls: unknown[] = [];
    const controller = new NotificationsInternalController(
      {
        dispatchPlayReminders: () =>
          Promise.resolve({ processed: 0, generated: 0, skipped: 0 }),
        dispatchWeeklyReportNotifications: (input: unknown) => {
          calls.push(input);
          return Promise.resolve({ processed: 1, generated: 1, skipped: 0 });
        },
      } as never,
      {} as never,
    );

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
