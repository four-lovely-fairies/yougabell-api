import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AiConfigService } from '../ai/ai-config.service';
import type { ContextBuilderService } from '../ai/context-builder.service';
import type { KnowledgeRetrievalService } from '../ai/knowledge-retrieval.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ChatService, sanitizeAssistantContent } from './chat.service';

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

  void it('정상 본문은 그대로 둔다', () => {
    const text = '성진님, 정말 대단하세요.\n\n오늘도 차근차근 해봐요.';
    assert.equal(sanitizeAssistantContent(text), text);
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

const aiDisabled = { isEnabled: false } as unknown as AiConfigService;
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
      aiDisabled,
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
      aiDisabled,
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

void describe('ChatService.streamMessage (AI disabled fallback)', () => {
  void it('persists user message, yields mock token stream + done event with cards', async () => {
    const prisma = createPrismaStub({ session: null });
    const service = new ChatService(
      prisma as unknown as PrismaService,
      aiDisabled,
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
    // user message + assistant message
    const createdRoles = prisma._messageCreates.map((c) => c.data.role);
    assert.deepEqual(createdRoles, ['user', 'assistant']);
    assert.equal(prisma._messageCreates[0].data.content, '잠자리 도와주세요');
    // assistant has cards
    const assistantCreate = prisma._messageCreates[1];
    const cardsArg = assistantCreate.data.cards?.create ?? [];
    assert.ok(
      cardsArg.length >= 1,
      'assistant message should include mock cards',
    );
    // events: at least one token + one done
    const tokens = events.filter((e) => e.type === 'token');
    const dones = events.filter((e) => e.type === 'done');
    const errors = events.filter((e) => e.type === 'error');
    assert.ok(tokens.length > 0, 'expected at least one token event');
    assert.equal(dones.length, 1, 'expected exactly one done event');
    assert.equal(errors.length, 0, 'should not emit error in mock fallback');
    // done payload includes content + cards
    const donePayload = dones[0].data as {
      messageId: string;
      content: string;
      cards: unknown[];
    };
    assert.ok(donePayload.messageId);
    assert.ok(donePayload.content.length > 10);
    assert.ok(donePayload.cards.length >= 1);
  });
});

void describe('ChatService.deleteChat', () => {
  void it('cascade deletes sessions for the user', async () => {
    const prisma = createPrismaStub({ session: null });
    const service = new ChatService(
      prisma as unknown as PrismaService,
      aiDisabled,
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
