import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminInquiriesService } from './admin-inquiries.service';

type PrismaArg = ConstructorParameters<typeof AdminInquiriesService>[0];
type PushArg = ConstructorParameters<typeof AdminInquiriesService>[1];

function createPushStub(calls: Record<string, unknown>[], fail = false) {
  return {
    sendToUser: (input: Record<string, unknown>) => {
      if (fail) return Promise.reject(new Error('expo down'));
      calls.push(input);
      return Promise.resolve({ attempted: 1, sent: 1, failed: 0 });
    },
  } as unknown as PushArg;
}

const ADMIN_ID = 'admin-1';
const INQUIRY_ID = 'inquiry-1';

void describe('AdminInquiriesService.updateInquiry', () => {
  void it('답변 본문을 저장하면 answered로 전환하고 알림을 만든다', async () => {
    const stub = createPrismaStub({ answerBody: null, answeredAt: null });
    const service = new AdminInquiriesService(
      stub as unknown as PrismaArg,
      createPushStub([]),
    );

    await service.updateInquiry(ADMIN_ID, INQUIRY_ID, {
      answerBody: '  확인 후 수정했습니다.  ',
    });

    assert.equal(stub.updates.length, 1);
    assert.equal(stub.updates[0].status, 'answered');
    assert.equal(stub.updates[0].answerBody, '확인 후 수정했습니다.');
    assert.equal(stub.updates[0].answeredBy, ADMIN_ID);
    assert.ok(stub.updates[0].answeredAt instanceof Date);

    assert.equal(stub.notifications.length, 1);
    assert.equal(stub.notifications[0].type, 'inquiry_answered');
    assert.equal(stub.notifications[0].targetType, 'inquiry');
    assert.equal(
      stub.notifications[0].targetUrl,
      `/settings/inquiries/${INQUIRY_ID}`,
    );
  });

  void it('이미 답변한 문의를 수정하면 알림을 중복 생성하지 않는다', async () => {
    const answeredAt = new Date('2026-08-19T00:00:00.000Z');
    const stub = createPrismaStub({ answerBody: '이전 답변', answeredAt });
    const service = new AdminInquiriesService(
      stub as unknown as PrismaArg,
      createPushStub([]),
    );

    await service.updateInquiry(ADMIN_ID, INQUIRY_ID, {
      answerBody: '수정한 답변',
    });

    assert.equal(stub.updates.length, 1);
    assert.equal(stub.updates[0].answerBody, '수정한 답변');
    // 최초 답변 시각은 보존한다 — 사용자가 언제 답변을 받았는지가 바뀌면 안 된다.
    assert.equal(stub.updates[0].answeredAt, answeredAt);
    assert.equal(stub.notifications.length, 0);
  });

  void it('답변 본문 없이 answered로 전환하면 400을 던진다', async () => {
    const stub = createPrismaStub({ answerBody: null, answeredAt: null });
    const service = new AdminInquiriesService(
      stub as unknown as PrismaArg,
      createPushStub([]),
    );

    await assert.rejects(
      () => service.updateInquiry(ADMIN_ID, INQUIRY_ID, { status: 'answered' }),
      (error: unknown) => {
        assert.equal(getErrorCode(error), 'ANSWER_BODY_REQUIRED');
        return true;
      },
    );
    assert.equal(stub.updates.length, 0);
    assert.equal(stub.notifications.length, 0);
  });

  void it('상태만 in_progress로 바꾸면 답변 필드를 건드리지 않는다', async () => {
    const stub = createPrismaStub({ answerBody: null, answeredAt: null });
    const service = new AdminInquiriesService(
      stub as unknown as PrismaArg,
      createPushStub([]),
    );

    await service.updateInquiry(ADMIN_ID, INQUIRY_ID, {
      status: 'in_progress',
    });

    assert.deepEqual(Object.keys(stub.updates[0]), ['status']);
    assert.equal(stub.updates[0].status, 'in_progress');
    assert.equal(stub.notifications.length, 0);
  });

  void it('첫 답변에는 푸시도 보내고, 재수정 시에는 보내지 않는다', async () => {
    const firstCalls: Record<string, unknown>[] = [];
    const first = createPrismaStub({ answerBody: null, answeredAt: null });
    await new AdminInquiriesService(
      first as unknown as PrismaArg,
      createPushStub(firstCalls),
    ).updateInquiry(ADMIN_ID, INQUIRY_ID, { answerBody: '답변' });

    assert.equal(firstCalls.length, 1);
    assert.equal(firstCalls[0].userId, 'user-1');
    assert.deepEqual(firstCalls[0].data, {
      actionType: 'url',
      targetType: 'inquiry',
      targetId: INQUIRY_ID,
      targetUrl: `/settings/inquiries/${INQUIRY_ID}`,
    });

    const againCalls: Record<string, unknown>[] = [];
    const again = createPrismaStub({
      answerBody: '이전 답변',
      answeredAt: new Date('2026-08-19T00:00:00.000Z'),
    });
    await new AdminInquiriesService(
      again as unknown as PrismaArg,
      createPushStub(againCalls),
    ).updateInquiry(ADMIN_ID, INQUIRY_ID, { answerBody: '수정' });

    assert.equal(againCalls.length, 0);
  });

  void it('푸시 발송이 실패해도 답변 저장은 되돌리지 않는다', async () => {
    const stub = createPrismaStub({ answerBody: null, answeredAt: null });
    const service = new AdminInquiriesService(
      stub as unknown as PrismaArg,
      createPushStub([], true),
    );

    await service.updateInquiry(ADMIN_ID, INQUIRY_ID, { answerBody: '답변' });

    assert.equal(stub.updates.length, 1);
    assert.equal(stub.notifications.length, 1);
  });

  void it('없는 문의를 수정하면 404를 던진다', async () => {
    const stub = createPrismaStub(null);
    const service = new AdminInquiriesService(
      stub as unknown as PrismaArg,
      createPushStub([]),
    );

    await assert.rejects(
      () => service.updateInquiry(ADMIN_ID, INQUIRY_ID, { status: 'answered' }),
      (error: unknown) => {
        assert.equal(getErrorCode(error), 'INQUIRY_NOT_FOUND');
        return true;
      },
    );
  });
});

function getErrorCode(error: unknown): string | undefined {
  return (error as { response?: { code?: string } }).response?.code;
}

type ExistingInquiry = {
  answerBody: string | null;
  answeredAt: Date | null;
} | null;

function createPrismaStub(existing: ExistingInquiry) {
  const updates: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];

  const tx = {
    inquiry: {
      update: ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return Promise.resolve({});
      },
    },
    notification: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        notifications.push(data);
        return Promise.resolve({});
      },
    },
  };

  return {
    updates,
    notifications,
    inquiry: {
      findUnique: ({ select }: { select?: unknown }) => {
        if (!existing) return Promise.resolve(null);
        // select가 있으면 updateInquiry의 선행 조회, 없으면 getInquiry의 상세 조회.
        if (select) {
          return Promise.resolve({
            id: INQUIRY_ID,
            userId: 'user-1',
            ...existing,
          });
        }
        return Promise.resolve(buildDetailRow(existing));
      },
    },
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };
}

function buildDetailRow(existing: NonNullable<ExistingInquiry>) {
  return {
    id: INQUIRY_ID,
    userId: 'user-1',
    category: null,
    title: '제목',
    body: '본문',
    contactEmail: null,
    status: 'answered',
    answerBody: existing.answerBody,
    answeredAt: existing.answeredAt,
    privacyConsentAgreedAt: new Date('2026-08-18T00:00:00.000Z'),
    privacyConsentVersion: '2026-08-19',
    createdAt: new Date('2026-08-18T00:00:00.000Z'),
    user: {
      name: '테스트',
      onboardedAt: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      deletedAt: null,
    },
  };
}
