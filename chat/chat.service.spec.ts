import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AiConfigService } from '../ai/ai-config.service';
import type { ContextBuilderService } from '../ai/context-builder.service';
import type { KnowledgeRetrievalService } from '../ai/knowledge-retrieval.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  containsSystemPromptLeak,
  sanitizeAssistantContent,
} from './chat-sanitize';
import { ChatService } from './chat.service';

void describe('sanitizeAssistantContent', () => {
  void it('인라인 출처 번호 표기를 제거한다', () => {
    const out = sanitizeAssistantContent(
      '아이가 진정될 때까지 옆에 있어주세요. [참고 자료 1]',
    );
    assert.equal(out, '아이가 진정될 때까지 옆에 있어주세요.');
  });

  void it('여러 번호·다양한 라벨의 인용 표기를 제거한다', () => {
    const out = sanitizeAssistantContent(
      '조용한 공간으로 옮겨주세요. [참고 자료 1, 2] 도움이 돼요. [출처 3]',
    );
    assert.equal(out, '조용한 공간으로 옮겨주세요. 도움이 돼요.');
  });

  void it('본문 끝에 누출된 cards/YAML 블록을 제거한다', () => {
    const out = sanitizeAssistantContent(
      '차근차근 이야기 나눠볼게요.\n\ncards:\n  type: text\n  content: |\n    떼쓰기 행동 가이드',
    );
    assert.equal(out, '차근차근 이야기 나눠볼게요.');
  });

  void it('cards 없이 단독 type:/content: 로 시작하는 누출 블록도 제거한다', () => {
    const out = sanitizeAssistantContent(
      '오늘도 충분히 잘하고 계세요.\n\ntype: text\ncontent: |\n  1. 물 마시기\n  2. 산책하기',
    );
    assert.equal(out, '오늘도 충분히 잘하고 계세요.');
  });

  void it('본문 맨 앞에서 시작하는 cards 블록 전체를 제거한다', () => {
    const out = sanitizeAssistantContent(
      'cards:\n  - type: info\n    title: 떼쓰는 아이 다루기 원칙\n    items:\n      - 차분하게 반응하기',
    );
    assert.equal(out, '');
  });

  void it('items: 로 시작하는 누출 줄도 제거한다', () => {
    const out = sanitizeAssistantContent(
      '오늘도 고생하셨어요.\n\nitems:\n  - 충분한 수면',
    );
    assert.equal(out, '오늘도 고생하셨어요.');
  });

  void it('리스트 마커가 붙은 "- type:"·"- title:" 누출 줄도 제거한다', () => {
    const out = sanitizeAssistantContent(
      '차분히 안아주세요.\n- type: info\n- title: 가이드\n  items:\n  - 수면',
    );
    assert.equal(out, '차분히 안아주세요.');
  });

  void it('한글 콜론 표현은 그대로 둔다', () => {
    const text = '정리하면 다음과 같아요: 첫째 차분히, 둘째 일관되게.';
    assert.equal(sanitizeAssistantContent(text), text);
  });

  void it('코드펜스 마커는 걷어내고 안의 텍스트는 남긴다', () => {
    const out = sanitizeAssistantContent(
      '차분히 안아주세요.\n```\n괜찮아요\n```',
    );
    assert.equal(out, '차분히 안아주세요.\n괜찮아요');
  });

  void it('정상 본문은 그대로 둔다', () => {
    const text = '성진님, 정말 대단하세요.\n\n오늘도 차근차근 해봐요.';
    assert.equal(sanitizeAssistantContent(text), text);
  });
});

// 2026-08-12 사고 회귀 — 모델이 시스템 프롬프트를 답변으로 되뱉어
// 3,718자가 사용자 화면에 그대로 노출됐다. 기존 sanitizer는 `cards:` YAML만
// 막고 있어 걸러지지 않았다.
void describe('sanitizeAssistantContent — 시스템 프롬프트 되뱉음', () => {
  void it('[본문 작성 규칙] 섹션부터 끝까지 제거한다', () => {
    const out = sanitizeAssistantContent(
      '오늘도 고생 많으셨어요.\n\n[본문 작성 규칙 — 매우 중요]\n- 본문은 한국어로 작성하며, 가벼운 마크다운을 쓸 수 있습니다.',
    );
    assert.equal(out, '오늘도 고생 많으셨어요.');
  });

  void it('본문 맨 앞부터 프롬프트가 시작되면 빈 본문이 된다', () => {
    const out = sanitizeAssistantContent(
      '[본문 작성 규칙 — 매우 중요]\n- 헤딩(#), 구분선(---)은 사용하지 마세요.',
    );
    assert.equal(out, '');
  });

  void it('[사용자 컨텍스트] 누출도 제거한다', () => {
    const out = sanitizeAssistantContent(
      '차분히 안아주세요.\n\n[사용자 컨텍스트]\n- 부모: 성진 (워킹대디)',
    );
    assert.equal(out, '차분히 안아주세요.');
  });

  void it('[원칙]·[답변 형식]·[지식 베이스 인용 규칙] 섹션도 제거한다', () => {
    for (const marker of ['[원칙]', '[답변 형식]', '[지식 베이스 인용 규칙]']) {
      const out = sanitizeAssistantContent(`괜찮아요.\n\n${marker}\n- 지시문`);
      assert.equal(out, '괜찮아요.', `marker=${marker}`);
    }
  });

  void it('정상 본문의 [참고 자료 N] 인용 표기는 기존대로 토큰만 지운다', () => {
    // '[참고 자료]'를 절단 마커에 넣으면 정상 답변이 통째로 잘린다 → 제외 확인.
    const out = sanitizeAssistantContent(
      '수면 루틴을 지켜주세요. [참고 자료 1] 오늘도 응원해요.',
    );
    assert.equal(out, '수면 루틴을 지켜주세요. 오늘도 응원해요.');
  });
});

void describe('containsSystemPromptLeak', () => {
  void it('프롬프트 섹션 헤더가 있으면 true', () => {
    assert.equal(
      containsSystemPromptLeak('안녕하세요.\n[본문 작성 규칙 — 매우 중요]'),
      true,
    );
  });

  void it('정상 본문이면 false', () => {
    assert.equal(
      containsSystemPromptLeak('오늘도 차근차근 해봐요. [참고 자료 1]'),
      false,
    );
  });

  void it('연속 호출해도 결과가 흔들리지 않는다 (정규식 lastIndex 상태 없음)', () => {
    const leaked = '[사용자 컨텍스트]\n- 부모: 성진';
    assert.equal(containsSystemPromptLeak(leaked), true);
    assert.equal(containsSystemPromptLeak(leaked), true);
  });
});

type ChatMessageRow = {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sentAt: Date;
  tokensUsed: number | null;
  cards: Array<{
    id: string;
    order: number;
    title: string;
    body: string;
    actionType: string | null;
    actionPayload: unknown;
  }>;
  sourceLinks: Array<{
    id: string;
    url: string;
    domain: string;
    title: string | null;
  }>;
};

type SessionRow = {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaStub = {
  chatSession: {
    findFirst: (args: unknown) => Promise<SessionRow | null>;
    create: (args: { data: { userId: string } }) => Promise<SessionRow>;
    update: (args: unknown) => Promise<SessionRow>;
    deleteMany: (args: {
      where: { userId: string };
    }) => Promise<{ count: number }>;
  };
  chatMessage: {
    findMany: (args: {
      where: { sessionId: string };
    }) => Promise<ChatMessageRow[]>;
    create: (args: {
      data: {
        sessionId: string;
        role: 'user' | 'assistant';
        content: string;
        tokensUsed?: number | null;
        cards?: {
          create: Array<{ order: number; title: string; body: string }>;
        };
      };
      include?: unknown;
    }) => Promise<ChatMessageRow>;
  };
};

const aiUnavailable = {
  chatModel: () => {
    throw new Error('AI provider not configured.');
  },
} as unknown as AiConfigService;
const contextBuilder = {} as unknown as ContextBuilderService;
const knowledgeDisabled = {
  retrieve: () => Promise.resolve([]),
  recordRetrievals: () => Promise.resolve(),
  isEnabled: false,
} as unknown as KnowledgeRetrievalService;

void describe('ChatService.getChat', () => {
  void it('returns empty response when no session exists', async () => {
    const prisma = createPrismaStub({ session: null });
    const service = new ChatService(
      prisma as unknown as PrismaService,
      aiUnavailable,
      contextBuilder,
      knowledgeDisabled,
    );

    const result = await service.getChat('user-1');

    assert.equal(result.session, null);
    assert.deepEqual(result.messages, []);
  });

  void it('returns session + messages in chronological order (oldest first)', async () => {
    const session: SessionRow = {
      id: 'session-1',
      userId: 'user-1',
      title: null,
      createdAt: new Date('2026-05-26T10:00:00Z'),
      updatedAt: new Date('2026-05-26T11:00:00Z'),
    };
    // findMany returns newest-first; service should reverse to oldest-first.
    const newestFirst: ChatMessageRow[] = [
      makeMessage({
        id: 'm-2',
        role: 'assistant',
        content: '답변',
        sentAt: new Date('2026-05-26T11:00:00Z'),
      }),
      makeMessage({
        id: 'm-1',
        role: 'user',
        content: '질문',
        sentAt: new Date('2026-05-26T10:30:00Z'),
      }),
    ];
    const prisma = createPrismaStub({ session, messages: newestFirst });
    const service = new ChatService(
      prisma as unknown as PrismaService,
      aiUnavailable,
      contextBuilder,
      knowledgeDisabled,
    );

    const result = await service.getChat('user-1');

    assert.equal(result.session?.id, 'session-1');
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[0].id, 'm-1');
    assert.equal(result.messages[0].role, 'user');
    assert.equal(result.messages[1].id, 'm-2');
    assert.equal(result.messages[1].role, 'assistant');
  });
});

void describe('ChatService.streamMessage', () => {
  void it('persists user message and emits an error when AI provider is unavailable', async () => {
    const prisma = createPrismaStub({ session: null });
    const service = new ChatService(
      prisma as unknown as PrismaService,
      aiUnavailable,
      contextBuilder,
      knowledgeDisabled,
    );

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of service.streamMessage(
      'user-1',
      '잠자리 도와주세요',
    )) {
      events.push(event);
    }

    // session lazy create
    assert.equal(prisma._calls.sessionCreate, 1);
    // user message only; assistant response is not fabricated when AI is unavailable.
    const createdRoles = prisma._messageCreates.map((c) => c.data.role);
    assert.deepEqual(createdRoles, ['user']);
    assert.equal(prisma._messageCreates[0].data.content, '잠자리 도와주세요');
    const tokens = events.filter((e) => e.type === 'token');
    const dones = events.filter((e) => e.type === 'done');
    const errors = events.filter((e) => e.type === 'error');
    assert.equal(tokens.length, 0);
    assert.equal(dones.length, 0);
    assert.equal(errors.length, 1);
  });
});

void describe('ChatService.deleteChat', () => {
  void it('cascade deletes sessions for the user', async () => {
    const prisma = createPrismaStub({ session: null });
    const service = new ChatService(
      prisma as unknown as PrismaService,
      aiUnavailable,
      contextBuilder,
      knowledgeDisabled,
    );

    await service.deleteChat('user-1');

    assert.deepEqual(prisma._calls.sessionDeleteManyArgs, [
      { userId: 'user-1' },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<ChatMessageRow>): ChatMessageRow {
  return {
    id: 'm-x',
    sessionId: 'session-1',
    role: 'user',
    content: '',
    sentAt: new Date(),
    tokensUsed: null,
    cards: [],
    sourceLinks: [],
    ...overrides,
  };
}

type PrismaStubInstance = PrismaStub & {
  _calls: {
    sessionCreate: number;
    sessionDeleteManyArgs: Array<{ userId: string }>;
  };
  _messageCreates: Array<{
    data: {
      sessionId: string;
      role: 'user' | 'assistant';
      content: string;
      tokensUsed?: number | null;
      cards?: { create: Array<{ order: number; title: string; body: string }> };
    };
  }>;
};

function createPrismaStub(input: {
  session: SessionRow | null;
  messages?: ChatMessageRow[];
}): PrismaStubInstance {
  let session = input.session;
  const messageCreates: PrismaStubInstance['_messageCreates'] = [];
  const calls: PrismaStubInstance['_calls'] = {
    sessionCreate: 0,
    sessionDeleteManyArgs: [],
  };
  let nextMessageId = 1;

  return {
    chatSession: {
      findFirst: () => Promise.resolve(session),
      create: ({ data }) => {
        calls.sessionCreate += 1;
        const created: SessionRow = {
          id: `session-${calls.sessionCreate}`,
          userId: data.userId,
          title: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        session = created;
        return Promise.resolve(created);
      },
      update: () => Promise.resolve(session as SessionRow),
      deleteMany: ({ where }) => {
        calls.sessionDeleteManyArgs.push(where);
        return Promise.resolve({ count: session ? 1 : 0 });
      },
    },
    chatMessage: {
      findMany: () => Promise.resolve(input.messages ?? []),
      create: ({ data }) => {
        messageCreates.push({ data });
        const id = `created-${nextMessageId++}`;
        const created: ChatMessageRow = {
          id,
          sessionId: data.sessionId,
          role: data.role,
          content: data.content,
          sentAt: new Date(),
          tokensUsed: data.tokensUsed ?? null,
          cards:
            data.cards?.create.map((card, index) => ({
              id: `card-${id}-${index}`,
              order: card.order,
              title: card.title,
              body: card.body,
              actionType: null,
              actionPayload: null,
            })) ?? [],
          sourceLinks: [],
        };
        return Promise.resolve(created);
      },
    },
    _calls: calls,
    _messageCreates: messageCreates,
  };
}
