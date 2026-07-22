import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationsAdminController } from './notifications.admin.controller';

void describe('NotificationsAdminController', () => {
  void it('force-sends a diagnostic push and returns per-token result', async () => {
    const calls: unknown[] = [];
    const controller = new NotificationsAdminController({
      sendToUserDetailed: (input: unknown) => {
        calls.push(input);
        return Promise.resolve({
          attempted: 1,
          sent: 1,
          failed: 0,
          tickets: [{ token: 'ExponentPushToken[ok]', status: 'ok' }],
        });
      },
    } as never);

    const result = await controller.testPush({
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
    assert.equal(result.sent, 1);
  });

  void it('passes through custom title/body when provided', async () => {
    const calls: Array<{ title: string; body: string }> = [];
    const controller = new NotificationsAdminController({
      sendToUserDetailed: (input: { title: string; body: string }) => {
        calls.push(input);
        return Promise.resolve({
          attempted: 0,
          sent: 0,
          failed: 0,
          tickets: [],
        });
      },
    } as never);

    await controller.testPush({
      userId: '00000000-0000-0000-0000-000000000000',
      title: '커스텀 제목',
      body: '커스텀 본문',
    });

    assert.equal(calls[0].title, '커스텀 제목');
    assert.equal(calls[0].body, '커스텀 본문');
  });
});
