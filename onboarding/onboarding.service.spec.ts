import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OnboardingService } from './onboarding.service';

const completeDto = {
  parent: {
    name: '홍길동',
    birthDate: '1990-01-01',
    gender: 'male',
    workStatus: 'working',
  },
  children: [
    {
      name: '아이',
      birthDate: '2023-04-20',
      gender: 'female',
      notes: null,
    },
  ],
  notification: {
    slot: 'morning',
    time: '08:30',
  },
  interests: ['sleep_routine'],
} as const;

void describe('OnboardingService', () => {
  void it('returns a non-onboarded placeholder for soft-deleted users', async () => {
    const deletedAt = new Date('2026-05-29T00:00:00.000Z');
    const service = new OnboardingService({} as never);

    const result = await service.getMe(
      {
        user: {
          findUnique: () =>
            Promise.resolve({
              id: 'user-1',
              name: '탈퇴 사용자',
              birthDate: new Date('1990-01-01T00:00:00.000Z'),
              gender: 'female',
              workStatus: 'working',
              notificationSlot: 'morning',
              notificationTime: '08:00',
              interests: ['sleep_routine'],
              onboardedAt: new Date('2026-05-20T00:00:00.000Z'),
              parentingStyleId: null,
              deletedAt,
              deletionReason: '테스트',
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
              updatedAt: new Date('2026-05-29T00:00:00.000Z'),
              children: [{ id: 'child-1' }],
              notificationPreferences: [{ type: 'play_10min' }],
            }),
        },
      } as never,
      'user-1',
    );

    assert.equal(result.id, 'user-1');
    assert.equal(result.onboardedAt, null);
    assert.equal(result.name, null);
    assert.equal(result.deletedAt, deletedAt);
    assert.deepEqual(result.children, []);
    assert.deepEqual(result.notificationPreferences, []);
  });

  void it('reactivates a soft-deleted account on onboarding complete', async () => {
    const updateManyCalls: unknown[] = [];
    const upsertCalls: unknown[] = [];
    const createManyCalls: unknown[] = [];
    const notificationUpsertCalls: unknown[] = [];

    const tx = {
      user: {
        findUnique: (args: { include?: unknown }) => {
          if (args.include) {
            return Promise.resolve({
              id: 'user-1',
              name: '홍길동',
              birthDate: new Date('1990-01-01T00:00:00.000Z'),
              gender: 'male',
              workStatus: 'working',
              notificationSlot: 'morning',
              notificationTime: '08:30',
              interests: ['sleep_routine'],
              onboardedAt: new Date('2026-05-29T00:00:00.000Z'),
              parentingStyleId: null,
              deletedAt: null,
              deletionReason: null,
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
              updatedAt: new Date('2026-05-29T00:00:00.000Z'),
              children: [],
              notificationPreferences: [],
            });
          }

          return Promise.resolve({
            id: 'user-1',
            onboardedAt: new Date('2026-05-20T00:00:00.000Z'),
            deletedAt: new Date('2026-05-28T00:00:00.000Z'),
          });
        },
        upsert: (args: unknown) => {
          upsertCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      child: {
        updateMany: (args: unknown) => {
          updateManyCalls.push(args);
          return Promise.resolve(undefined);
        },
        createMany: (args: unknown) => {
          createManyCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      notificationPreference: {
        upsert: (args: unknown) => {
          notificationUpsertCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
    };

    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };

    const service = new OnboardingService(prisma as never);
    const result = await service.complete('user-1', completeDto as never);

    assert.equal(updateManyCalls.length, 1);
    assert.equal(createManyCalls.length, 1);
    assert.equal(upsertCalls.length, 1);
    assert.equal(notificationUpsertCalls.length, 2);
    assert.equal(result.deletedAt, null);
    assert.ok(result.onboardedAt instanceof Date);

    const upsertArg = upsertCalls[0] as {
      update: { deletedAt: null; deletionReason: null };
    };
    assert.equal(upsertArg.update.deletedAt, null);
    assert.equal(upsertArg.update.deletionReason, null);

    const prefArg = notificationUpsertCalls[0] as {
      create: { enabled: boolean; time: string };
      update: { enabled: boolean; time: string };
    };
    assert.equal(prefArg.create.enabled, true);
    assert.equal(prefArg.create.time, '08:30');
    assert.equal(prefArg.update.enabled, true);
    assert.equal(prefArg.update.time, '08:30');
  });

  void it('creates disabled notification preferences when onboarding skips notifications', async () => {
    const notificationUpsertCalls: unknown[] = [];

    const tx = {
      user: {
        findUnique: (args: { include?: unknown }) => {
          if (args.include) {
            return Promise.resolve({
              id: 'user-1',
              name: '홍길동',
              birthDate: new Date('1990-01-01T00:00:00.000Z'),
              gender: 'male',
              workStatus: 'working',
              notificationSlot: null,
              notificationTime: null,
              interests: ['sleep_routine'],
              onboardedAt: new Date('2026-05-29T00:00:00.000Z'),
              parentingStyleId: null,
              deletedAt: null,
              deletionReason: null,
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
              updatedAt: new Date('2026-05-29T00:00:00.000Z'),
              children: [],
              notificationPreferences: [],
            });
          }

          return Promise.resolve(null);
        },
        upsert: () => Promise.resolve(undefined),
      },
      child: {
        createMany: () => Promise.resolve(undefined),
        updateMany: () => Promise.resolve(undefined),
      },
      notificationPreference: {
        upsert: (args: unknown) => {
          notificationUpsertCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
    };

    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };

    const service = new OnboardingService(prisma as never);
    await service.complete('user-1', {
      ...completeDto,
      notification: undefined,
    } as never);

    assert.equal(notificationUpsertCalls.length, 2);
    const prefArg = notificationUpsertCalls[0] as {
      create: { enabled: boolean; time: string };
    };
    assert.equal(prefArg.create.enabled, false);
    assert.equal(prefArg.create.time, '19:00');
  });
});
