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
          findUnique: async () => ({
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

    const tx = {
      user: {
        findUnique: async (args: { include?: unknown }) => {
          if (args.include) {
            return {
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
            };
          }

          return {
            id: 'user-1',
            onboardedAt: new Date('2026-05-20T00:00:00.000Z'),
            deletedAt: new Date('2026-05-28T00:00:00.000Z'),
          };
        },
        upsert: async (args: unknown) => {
          upsertCalls.push(args);
        },
      },
      child: {
        updateMany: async (args: unknown) => {
          updateManyCalls.push(args);
        },
        createMany: async (args: unknown) => {
          createManyCalls.push(args);
        },
      },
    };

    const prisma = {
      $transaction: async (
        callback: (client: typeof tx) => Promise<unknown>,
      ) => callback(tx),
    };

    const service = new OnboardingService(prisma as never);
    const result = await service.complete('user-1', completeDto as never);

    assert.equal(updateManyCalls.length, 1);
    assert.equal(createManyCalls.length, 1);
    assert.equal(upsertCalls.length, 1);
    assert.equal(result.deletedAt, null);
    assert.ok(result.onboardedAt instanceof Date);

    const upsertArg = upsertCalls[0] as {
      update: { deletedAt: null; deletionReason: null };
    };
    assert.equal(upsertArg.update.deletedAt, null);
    assert.equal(upsertArg.update.deletionReason, null);
  });
});
