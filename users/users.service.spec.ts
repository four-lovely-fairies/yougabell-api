import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UsersService } from './users.service';

void describe('UsersService home notification nudge exposure', () => {
  void it('returns true only when the account wins the atomic first-exposure update', async () => {
    const calls: unknown[] = [];
    const prisma = {
      user: {
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
      },
    };
    const service = new UsersService(prisma as never, {} as never);

    const result = await service.claimHomeNotificationNudgeExposure('user-1');

    assert.deepEqual(result, { shouldShow: true });
    assert.deepEqual(calls, [
      {
        where: {
          id: 'user-1',
          deletedAt: null,
          homeNotificationNudgeShownAt: null,
        },
        data: { homeNotificationNudgeShownAt: callsDate(calls) },
      },
    ]);
  });

  void it('returns false after the exposure was already claimed', async () => {
    const prisma = {
      user: { updateMany: async () => ({ count: 0 }) },
    };
    const service = new UsersService(prisma as never, {} as never);

    const result = await service.claimHomeNotificationNudgeExposure('user-1');

    assert.deepEqual(result, { shouldShow: false });
  });
});

const callsDate = (calls: unknown[]) => {
  const firstCall = calls[0] as {
    data: { homeNotificationNudgeShownAt: Date };
  };
  assert.ok(firstCall.data.homeNotificationNudgeShownAt instanceof Date);
  return firstCall.data.homeNotificationNudgeShownAt;
};
