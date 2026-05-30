import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationDispatchService } from './notification-dispatch.service';

void describe('NotificationDispatchService', () => {
  void it('creates one daily play reminder for matching enabled users', async () => {
    const createCalls: unknown[] = [];
    const service = new NotificationDispatchService({
      notificationPreference: {
        findMany: () =>
          Promise.resolve([
            {
              userId: 'user-1',
              time: '19:00',
              user: {
                children: [{ id: 'child-1', name: '아이' }],
              },
            },
          ]),
      },
      notification: {
        findFirst: () => Promise.resolve(null),
        create: (args: unknown) => {
          createCalls.push(args);
          return Promise.resolve(args);
        },
      },
      weeklyReport: {
        findMany: () => Promise.resolve([]),
      },
    } as never);

    const result = await service.dispatchPlayReminders({
      now: '2026-05-30T10:00:00.000Z',
    });

    assert.deepEqual(result, { processed: 1, generated: 1, skipped: 0 });
    assert.equal(createCalls.length, 1);
  });

  void it('creates monday weekly report notifications at the configured time', async () => {
    const createCalls: unknown[] = [];
    const service = new NotificationDispatchService({
      notificationPreference: {
        findMany: () =>
          Promise.resolve([
            {
              userId: 'user-1',
              time: '12:00',
            },
          ]),
      },
      notification: {
        findFirst: () => Promise.resolve(null),
        create: (args: unknown) => {
          createCalls.push(args);
          return Promise.resolve(args);
        },
      },
      weeklyReport: {
        findMany: () =>
          Promise.resolve([
            {
              id: 'report-1',
              userId: 'user-1',
              childId: 'child-1',
            },
          ]),
      },
    } as never);

    const result = await service.dispatchWeeklyReportNotifications({
      now: '2026-06-01T03:00:00.000Z',
    });

    assert.deepEqual(result, { processed: 1, generated: 1, skipped: 0 });
    assert.equal(createCalls.length, 1);
  });

  void it('skips weekly report notifications outside monday', async () => {
    const service = new NotificationDispatchService({
      notificationPreference: {
        findMany: () => Promise.resolve([]),
      },
      notification: {
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve(null),
      },
      weeklyReport: {
        findMany: () => Promise.resolve([]),
      },
    } as never);

    const result = await service.dispatchWeeklyReportNotifications({
      now: '2026-06-02T03:00:00.000Z',
    });

    assert.deepEqual(result, { processed: 0, generated: 0, skipped: 0 });
  });
});
