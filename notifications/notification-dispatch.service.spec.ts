import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationDispatchService } from './notification-dispatch.service';

void describe('NotificationDispatchService', () => {
  void it('creates one daily play reminder for matching enabled users', async () => {
    const createCalls: unknown[] = [];
    const pushCalls: unknown[] = [];
    const service = new NotificationDispatchService(
      {
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
      } as never,
      {
        sendToUser: (args: unknown) => {
          pushCalls.push(args);
          return Promise.resolve({ attempted: 1, sent: 1, failed: 0 });
        },
      },
    );

    const result = await service.dispatchPlayReminders({
      now: '2026-05-30T10:00:00.000Z',
    });

    assert.deepEqual(result, { processed: 1, generated: 1, skipped: 0 });
    assert.equal(createCalls.length, 1);
    assert.deepEqual(pushCalls, [
      {
        userId: 'user-1',
        title: '10분 놀이 시간이에요',
        body: '아이와 오늘의 10분 놀이를 시작해보세요.',
        data: {
          actionType: 'open_mission',
          targetType: 'child',
          targetId: 'child-1',
        },
      },
    ]);
  });

  void it('matches reminder times within the configured minute window', async () => {
    const findManyCalls: unknown[] = [];
    const service = new NotificationDispatchService({
      notificationPreference: {
        findMany: (args: unknown) => {
          findManyCalls.push(args);
          return Promise.resolve([]);
        },
      },
      notification: {
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve(null),
      },
      weeklyReport: {
        findMany: () => Promise.resolve([]),
      },
    } as never);

    await service.dispatchPlayReminders({
      now: '2026-05-30T10:04:00.000Z',
      windowMinutes: 5,
    });

    assert.deepEqual(findManyCalls, [
      {
        where: {
          type: 'play_10min',
          enabled: true,
          time: { in: ['19:04', '19:03', '19:02', '19:01', '19:00'] },
          user: {
            deletedAt: null,
            onboardedAt: { not: null },
          },
        },
        include: {
          user: {
            select: {
              children: {
                where: { deletedAt: null },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    ]);
  });

  void it('creates monday weekly report notifications at the configured time', async () => {
    const createCalls: unknown[] = [];
    const pushCalls: unknown[] = [];
    const service = new NotificationDispatchService(
      {
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
      } as never,
      {
        sendToUser: (args: unknown) => {
          pushCalls.push(args);
          return Promise.resolve({ attempted: 1, sent: 1, failed: 0 });
        },
      },
    );

    const result = await service.dispatchWeeklyReportNotifications({
      now: '2026-06-01T03:00:00.000Z',
    });

    assert.deepEqual(result, { processed: 1, generated: 1, skipped: 0 });
    assert.equal(createCalls.length, 1);
    assert.deepEqual(pushCalls, [
      {
        userId: 'user-1',
        title: '주간 리포트가 준비됐어요',
        body: '지난주 아이와 함께한 시간을 확인해보세요.',
        data: {
          actionType: 'open_report',
          targetType: 'weekly_report',
          targetId: 'report-1',
        },
      },
    ]);
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
