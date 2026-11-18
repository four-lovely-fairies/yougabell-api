import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateInviteCode,
  inviterNotificationCopy,
  normalizeInviteCode,
  normalizePhone,
  ReferralService,
} from './referral.service';

function makeService(prisma: Record<string, unknown>, pushed: unknown[] = []) {
  const push = {
    sendToUser: (input: unknown) => {
      pushed.push(input);
      return Promise.resolve({ attempted: 1, sent: 1 });
    },
  };
  return new ReferralService(prisma as never, push as never);
}

void describe('referral helpers', () => {
  void it('초대 코드는 공백을 없애고 대문자로 맞춘다', () => {
    assert.equal(normalizeInviteCode(' yb4k2 '), 'YB4K2');
  });

  void it('초대 코드는 헷갈리는 글자 없이 5자리', () => {
    const code = generateInviteCode();
    assert.match(code, /^[A-HJKMNP-Z2-9]{5}$/);
  });

  void it('휴대폰 번호는 숫자만 남기고 010 형식만 허용', () => {
    assert.equal(normalizePhone('010-1234-5678'), '01012345678');
    assert.equal(normalizePhone('02-123-4567'), null);
  });

  void it('알림 문구 — 남은 인원 / 4명 달성', () => {
    assert.match(inviterNotificationCopy('하윤맘', 2).body, /2명만 더/);
    assert.equal(
      inviterNotificationCopy('지우아빠', 4).title,
      '커피 쿠폰이 도착했어요',
    );
  });
});

void describe('ReferralService', () => {
  void it('checkCode — 없는 코드 / 내 코드 / 정상', async () => {
    const owners: Record<string, { id: string; deletedAt: null }> = {
      YB4K2: { id: 'inviter', deletedAt: null },
    };
    const service = makeService({
      user: {
        findUnique: ({ where }: { where: { referralCode: string } }) =>
          Promise.resolve(owners[where.referralCode] ?? null),
      },
    });
    assert.deepEqual(await service.checkCode('me', 'YB4K9'), {
      valid: false,
      reason: 'not_found',
    });
    assert.deepEqual(await service.checkCode('inviter', 'yb4k2'), {
      valid: false,
      reason: 'self',
    });
    assert.deepEqual(await service.checkCode('me', 'yb4k2'), { valid: true });
  });

  void it('recordSignup — 처음 가입하는 사람만 기록한다', async () => {
    const created: unknown[] = [];
    const tx = {
      user: {
        findUnique: () => Promise.resolve({ id: 'inviter', deletedAt: null }),
      },
      referral: {
        findUnique: () => Promise.resolve(null),
        create: (args: { data: unknown }) => {
          created.push(args.data);
          return Promise.resolve(args.data);
        },
      },
    };
    const service = makeService({});
    assert.equal(
      await service.recordSignup(tx as never, 'friend', 'YB4K2', false),
      null,
      '탈퇴 후 재가입은 인정 안 함',
    );
    assert.equal(
      await service.recordSignup(tx as never, 'inviter', 'YB4K2', true),
      null,
      '내 코드는 인정 안 함',
    );
    assert.equal(
      await service.recordSignup(tx as never, 'friend', 'yb4k2', true),
      'inviter',
    );
    assert.deepEqual(created, [
      { inviterId: 'inviter', inviteeId: 'friend', code: 'YB4K2' },
    ]);
  });

  void it('notifyInviter — 앱 알림과 푸시를 보낸다', async () => {
    const notifications: Array<Record<string, unknown>> = [];
    const pushed: unknown[] = [];
    const service = makeService(
      {
        referral: { count: () => Promise.resolve(4) },
        notification: {
          create: (args: { data: Record<string, unknown> }) => {
            notifications.push(args.data);
            return Promise.resolve(args.data);
          },
        },
      },
      pushed,
    );
    await service.notifyInviter('inviter', '하윤맘');
    assert.equal(notifications[0].type, 'referral_joined');
    assert.equal(notifications[0].targetUrl, '/referral?from=notification');
    assert.equal(notifications[0].priority, 'high');
    assert.equal(pushed.length, 1);
  });

  void it('claimReward — 4명 미만이면 거절, 4명이면 번호 저장', async () => {
    let count = 3;
    const saved: Array<Record<string, unknown>> = [];
    const service = makeService({
      referral: { count: () => Promise.resolve(count) },
      referralRewardClaim: {
        findUnique: () => Promise.resolve(null),
        create: (args: { data: Record<string, unknown> }) => {
          saved.push(args.data);
          return Promise.resolve({ ...args.data, createdAt: new Date() });
        },
      },
    });
    await assert.rejects(service.claimReward('me', '010-1234-5678'));
    count = 4;
    const claim = await service.claimReward('me', '010-1234-5678');
    assert.equal(claim.phone, '01012345678');
    assert.equal(saved[0].inviteCount, 4);
  });
});
