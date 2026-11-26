import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UsersService } from './users.service';

void describe('UsersService', () => {
  void it('removes push tokens and notifications immediately when an account is soft-deleted', async () => {
    const userUpdateCalls: unknown[] = [];
    const pushTokenDeleteCalls: unknown[] = [];
    const notificationDeleteCalls: unknown[] = [];
    const tx = {
      user: {
        update: (args: unknown) => {
          userUpdateCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      userPushToken: {
        deleteMany: (args: unknown) => {
          pushTokenDeleteCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      notification: {
        deleteMany: (args: unknown) => {
          notificationDeleteCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
    };
    const prisma = {
      user: {
        findUnique: () => Promise.resolve({ id: 'user-1', deletedAt: null }),
      },
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };
    const service = new UsersService(prisma as never, {} as never);

    await service.softDeleteAccount('user-1', { reason: '재가입 테스트' });

    assert.equal(userUpdateCalls.length, 1);
    assert.deepEqual(pushTokenDeleteCalls, [{ where: { userId: 'user-1' } }]);
    assert.deepEqual(notificationDeleteCalls, [
      { where: { userId: 'user-1' } },
    ]);
  });

  void it('stores the selected deletion reason with trimmed detail', async () => {
    const reasonCreateCalls: unknown[] = [];
    const userUpdateCalls: { data: { deletionReason: unknown } }[] = [];
    const tx = {
      user: {
        update: (args: { data: { deletionReason: unknown } }) => {
          userUpdateCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      accountDeletionReason: {
        create: (args: unknown) => {
          reasonCreateCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      userPushToken: { deleteMany: () => Promise.resolve(undefined) },
      notification: { deleteMany: () => Promise.resolve(undefined) },
    };
    const prisma = {
      user: {
        findUnique: () => Promise.resolve({ id: 'user-1', deletedAt: null }),
      },
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };
    const service = new UsersService(prisma as never, {} as never);

    await service.softDeleteAccount('user-1', {
      reasonCode: 'other',
      reason: '  알림이 너무 많아요  ',
    });

    assert.deepEqual(reasonCreateCalls, [
      {
        data: {
          userId: 'user-1',
          reason: 'other',
          detail: '알림이 너무 많아요',
        },
      },
    ]);
    assert.equal(userUpdateCalls[0].data.deletionReason, '알림이 너무 많아요');
  });

  void it('does not store a deletion reason row when no reason is selected', async () => {
    const reasonCreateCalls: unknown[] = [];
    const tx = {
      user: { update: () => Promise.resolve(undefined) },
      accountDeletionReason: {
        create: (args: unknown) => {
          reasonCreateCalls.push(args);
          return Promise.resolve(undefined);
        },
      },
      userPushToken: { deleteMany: () => Promise.resolve(undefined) },
      notification: { deleteMany: () => Promise.resolve(undefined) },
    };
    const prisma = {
      user: {
        findUnique: () => Promise.resolve({ id: 'user-1', deletedAt: null }),
      },
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };
    const service = new UsersService(prisma as never, {} as never);

    await service.softDeleteAccount('user-1', {});

    assert.deepEqual(reasonCreateCalls, []);
  });
});
