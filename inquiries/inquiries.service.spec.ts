import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InquiriesService,
  MAX_OPEN_INQUIRIES,
  assertAnswerBodyPresent,
} from './inquiries.service';
import { INQUIRY_PRIVACY_CONSENT_VERSION } from './inquiry.constants';

type PrismaArg = ConstructorParameters<typeof InquiriesService>[0];

void describe('InquiriesService', () => {
  void it('미답변 문의가 한도에 도달하면 등록을 거부한다', async () => {
    const service = new InquiriesService(
      createPrismaStub({
        openCount: MAX_OPEN_INQUIRIES,
      }) as unknown as PrismaArg,
    );

    await assert.rejects(
      () =>
        service.createInquiry('user-1', {
          title: '제목',
          body: '열 글자가 넘는 문의 본문입니다.',
          privacyConsent: true,
        }),
      (error: unknown) => {
        assert.equal(getErrorCode(error), 'TOO_MANY_OPEN_INQUIRIES');
        return true;
      },
    );
  });

  void it('한도 미만이면 등록되고 제목·본문이 trim된다', async () => {
    const created: Record<string, unknown>[] = [];
    const service = new InquiriesService(
      createPrismaStub({
        openCount: MAX_OPEN_INQUIRIES - 1,
        created,
      }) as unknown as PrismaArg,
    );

    await service.createInquiry('user-1', {
      title: '  제목  ',
      body: '  열 글자가 넘는 문의 본문입니다.  ',
      privacyConsent: true,
    });

    assert.equal(created.length, 1);
    assert.equal(created[0].title, '제목');
    assert.equal(created[0].body, '열 글자가 넘는 문의 본문입니다.');
  });

  void it('contactEmail 미지정 시 로그인 이메일로 대체한다', async () => {
    const created: Record<string, unknown>[] = [];
    const service = new InquiriesService(
      createPrismaStub({ openCount: 0, created }) as unknown as PrismaArg,
    );

    await service.createInquiry(
      'user-1',
      {
        title: '제목',
        body: '열 글자가 넘는 문의 본문입니다.',
        privacyConsent: true,
      },
      'parent@example.com',
    );

    assert.equal(created[0].contactEmail, 'parent@example.com');
  });

  void it('동의 버전을 문의 행에 함께 남긴다', async () => {
    const created: Record<string, unknown>[] = [];
    const service = new InquiriesService(
      createPrismaStub({ openCount: 0, created }) as unknown as PrismaArg,
    );

    await service.createInquiry('user-1', {
      title: '제목',
      body: '열 글자가 넘는 문의 본문입니다.',
      privacyConsent: true,
    });

    assert.equal(
      created[0].privacyConsentVersion,
      INQUIRY_PRIVACY_CONSENT_VERSION,
    );
  });

  void it('타인 문의를 조회하면 존재를 노출하지 않고 404를 던진다', async () => {
    const service = new InquiriesService(
      createPrismaStub({ openCount: 0, found: null }) as unknown as PrismaArg,
    );

    await assert.rejects(
      () => service.getInquiry('user-1', 'other-user-inquiry'),
      (error: unknown) => {
        assert.equal(getErrorCode(error), 'INQUIRY_NOT_FOUND');
        return true;
      },
    );
  });
});

void describe('assertAnswerBodyPresent', () => {
  void it('새 답변 본문이 있으면 통과한다', () => {
    assert.doesNotThrow(() => assertAnswerBodyPresent('답변입니다', null));
  });

  void it('기존 답변이 남아 있으면 본문 없이도 통과한다', () => {
    assert.doesNotThrow(() => assertAnswerBodyPresent(undefined, '이전 답변'));
  });

  void it('양쪽 모두 비어 있으면 400을 던진다', () => {
    assert.throws(
      () => assertAnswerBodyPresent('   ', null),
      (error: unknown) => {
        assert.equal(getErrorCode(error), 'ANSWER_BODY_REQUIRED');
        return true;
      },
    );
  });
});

function getErrorCode(error: unknown): string | undefined {
  const response = (error as { response?: { code?: string } }).response;
  return response?.code;
}

function createPrismaStub(options: {
  openCount: number;
  created?: Record<string, unknown>[];
  found?: unknown;
}) {
  return {
    inquiry: {
      count: () => Promise.resolve(options.openCount),
      create: ({ data }: { data: Record<string, unknown> }) => {
        options.created?.push(data);
        return Promise.resolve({
          ...data,
          id: 'inquiry-1',
          status: 'received',
          answerBody: null,
          answeredAt: null,
          privacyConsentAgreedAt: new Date('2026-08-19T00:00:00.000Z'),
          createdAt: new Date('2026-08-19T00:00:00.000Z'),
        });
      },
      findFirst: () => Promise.resolve(options.found ?? null),
    },
  };
}
