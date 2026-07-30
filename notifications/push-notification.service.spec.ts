import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PushNotificationService } from './push-notification.service';

void describe('PushNotificationService', () => {
  void it('sends Expo push messages to every token for a user', async () => {
    const fetchCalls: unknown[] = [];
    const service = new PushNotificationService({
      userPushToken: {
        findMany: () =>
          Promise.resolve([
            { token: 'ExponentPushToken[token-1]' },
            { token: 'ExpoPushToken[token-2]' },
          ]),
      },
    } as never);
    Object.defineProperty(service, 'fetcher', {
      value: (...args: Parameters<typeof fetch>) => {
        fetchCalls.push(args);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ status: 'ok' }, { status: 'ok' }],
            }),
        } as Response);
      },
    });

    const result = await service.sendToUser({
      userId: 'user-1',
      title: '10분 놀이 시간이에요',
      body: '아이와 오늘의 10분 놀이를 시작해보세요.',
      data: { actionType: 'open_mission', targetType: 'child' },
    });

    assert.deepEqual(result, { attempted: 2, sent: 2, failed: 0 });
    assert.equal(fetchCalls.length, 1);
    const [url, init] = fetchCalls[0] as [string, RequestInit];
    assert.equal(url, 'https://exp.host/--/api/v2/push/send');
    const body = init.body;
    if (typeof body !== 'string') {
      throw new Error('expected JSON string body');
    }
    assert.deepEqual(JSON.parse(body), [
      {
        to: 'ExponentPushToken[token-1]',
        title: '10분 놀이 시간이에요',
        body: '아이와 오늘의 10분 놀이를 시작해보세요.',
        sound: 'default',
        data: { actionType: 'open_mission', targetType: 'child' },
      },
      {
        to: 'ExpoPushToken[token-2]',
        title: '10분 놀이 시간이에요',
        body: '아이와 오늘의 10분 놀이를 시작해보세요.',
        sound: 'default',
        data: { actionType: 'open_mission', targetType: 'child' },
      },
    ]);
  });

  void it('does not call Expo when the user has no push tokens', async () => {
    const fetchCalls: unknown[] = [];
    const service = new PushNotificationService({
      userPushToken: {
        findMany: () => Promise.resolve([]),
      },
    } as never);
    Object.defineProperty(service, 'fetcher', {
      value: (...args: Parameters<typeof fetch>) => {
        fetchCalls.push(args);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        } as Response);
      },
    });

    const result = await service.sendToUser({
      userId: 'user-1',
      title: '제목',
      body: '본문',
      data: {},
    });

    assert.deepEqual(result, { attempted: 0, sent: 0, failed: 0 });
    assert.equal(fetchCalls.length, 0);
  });

  void it('surfaces per-token Expo errors for diagnostics', async () => {
    const service = new PushNotificationService({
      userPushToken: {
        findMany: () =>
          Promise.resolve([
            { token: 'ExponentPushToken[live]' },
            { token: 'ExponentPushToken[dead]' },
          ]),
      },
    } as never);
    Object.defineProperty(service, 'fetcher', {
      value: () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { status: 'ok' },
                {
                  status: 'error',
                  message: 'device not registered',
                  details: { error: 'DeviceNotRegistered' },
                },
              ],
            }),
        } as Response),
    });

    const result = await service.sendToUserDetailed({
      userId: 'user-1',
      title: '테스트',
      body: '본문',
      data: {},
    });

    assert.equal(result.attempted, 2);
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
    assert.deepEqual(result.tickets, [
      { token: 'ExponentPushToken[live]', status: 'ok' },
      {
        token: 'ExponentPushToken[dead]',
        status: 'error',
        error: 'DeviceNotRegistered',
        message: 'device not registered',
      },
    ]);
  });
});
