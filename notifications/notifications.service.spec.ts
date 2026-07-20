import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationsService } from './notifications.service';

void describe('NotificationsService push tokens', () => {
  void it('upserts an Expo push token by user and device', async () => {
    const upsertCalls: unknown[] = [];
    const service = new NotificationsService({
      userPushToken: {
        upsert: (args: unknown) => {
          upsertCalls.push(args);
          return Promise.resolve(args);
        },
      },
    } as never);

    await service.upsertPushToken('user-1', {
      deviceId: 'device-1',
      token: 'ExponentPushToken[abc123]',
      platform: 'ios',
    });

    assert.deepEqual(upsertCalls, [
      {
        where: { userId_deviceId: { userId: 'user-1', deviceId: 'device-1' } },
        create: {
          userId: 'user-1',
          deviceId: 'device-1',
          token: 'ExponentPushToken[abc123]',
          platform: 'ios',
        },
        update: {
          token: 'ExponentPushToken[abc123]',
          platform: 'ios',
        },
      },
    ]);
  });

  void it('deletes a push token only for the current user', async () => {
    const deleteManyCalls: unknown[] = [];
    const service = new NotificationsService({
      userPushToken: {
        deleteMany: (args: unknown) => {
          deleteManyCalls.push(args);
          return Promise.resolve({ count: 1 });
        },
      },
    } as never);

    const result = await service.deletePushToken('user-1', 'device-1');

    assert.deepEqual(result, { deletedCount: 1 });
    assert.deepEqual(deleteManyCalls, [
      {
        where: { userId: 'user-1', deviceId: 'device-1' },
      },
    ]);
  });
});
