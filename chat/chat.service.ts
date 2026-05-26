import { Injectable, Logger } from '@nestjs/common';
import { ChatRole, Prisma } from '@prisma/client';
import { generateText, Output, streamText, type ModelMessage } from 'ai';
import { AiConfigService } from '../ai/ai-config.service';
import { ContextBuilderService } from '../ai/context-builder.service';
import {
  CHAT_CARDS_SYSTEM_PROMPT,
  ChatCardsSchema,
  type ChatCardsPayload,
} from '../ai/prompts/chat-cards';
import { buildChatSystemPrompt } from '../ai/prompts/chat-system';
import { PrismaService } from '../prisma/prisma.service';
import { MOCK_ASSISTANT_REPLY } from './chat.mock-reply';
import {
  CHAT_RECENT_MESSAGES_LIMIT,
  type ChatMessage,
  type ChatResponse,
  type ChatStreamEvent,
} from './chat.types';

const RECENT_HISTORY_FOR_PROMPT = 10;

type MessageWithRelations = Prisma.ChatMessageGetPayload<{
  include: { cards: true; sourceLinks: true };
}>;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  /**
   * 단일 영속 세션 — userId당 가장 최근 세션 1개 + 최근 N개 메시지.
   * 기획 docs/features/20260525-ai-integration.md §1 결정 "단일 영속 세션".
   */
  async getChat(userId: string): Promise<ChatResponse> {
    const session = await this.prisma.chatSession.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return { session: null, messages: [] };
    }

    const recent = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { sentAt: 'desc' },
      take: CHAT_RECENT_MESSAGES_LIMIT,
      include: { cards: true, sourceLinks: true },
    });

    return {
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      // 최신 → 과거로 fetch 후 화면용으로 과거 → 최신 정렬
      messages: recent.reverse().map(toChatMessage),
    };
  }

  async deleteChat(userId: string): Promise<void> {
    await this.prisma.chatSession.deleteMany({ where: { userId } });
  }

  /**
   * Phase 2 — Gemini SSE 스트리밍.
   * GOOGLE_GENERATIVE_AI_API_KEY 미설정 시 mock 응답을 토큰 단위로 흘려보냄.
   * 이벤트:
   *   - token: { text } — 본문 청크
   *   - done:  { messageId, content, cards, sources } — 완료 + 영속화된 메시지
   *   - error: { message } — 실패
   */
  async *streamMessage(
    userId: string,
    content: string,
  ): AsyncGenerator<ChatStreamEvent> {
    const session = await this.getOrCreateSession(userId);

    // 사용자 메시지 영속화 (client는 낙관적 표시 → 서버 응답으로 교체)
    await this.prisma.chatMessage.create({
      data: { sessionId: session.id, role: ChatRole.user, content },
    });

    try {
      if (!this.aiConfig.isEnabled) {
        yield* this.streamMockReply(session.id);
        return;
      }
      yield* this.streamGeminiReply(session.id, userId, content);
    } catch (err) {
      this.logger.error('chat stream failed', err as Error);
      yield {
        type: 'error',
        data: {
          message: '응답에 실패했어요. 잠시 후 다시 시도해 주세요.',
        },
      };
    } finally {
      await this.prisma.chatSession
        .update({ where: { id: session.id }, data: { updatedAt: new Date() } })
        .catch(() => undefined);
    }
  }

  private async *streamMockReply(
    sessionId: string,
  ): AsyncGenerator<ChatStreamEvent> {
    const content = MOCK_ASSISTANT_REPLY.content;
    // 문장 단위로 잘라서 token처럼 흘려보냄 (실서비스 typing 효과 모방)
    const chunks = splitForStreaming(content);
    for (const chunk of chunks) {
      yield { type: 'token', data: { text: chunk } };
      await sleep(40);
    }
    const assistant = await this.saveAssistant({
      sessionId,
      content,
      cards: MOCK_ASSISTANT_REPLY.cards.map((card) => ({
        title: card.title,
        body: card.body,
      })),
      sources: [],
    });
    yield {
      type: 'done',
      data: {
        messageId: assistant.id,
        content,
        cards: assistant.cards.map((card) => ({
          id: card.id,
          order: card.order,
          title: card.title,
          body: card.body,
          actionType: card.actionType,
          actionPayload:
            card.actionPayload === null
              ? null
              : (card.actionPayload as Record<string, unknown>),
        })),
        sources: assistant.sourceLinks.map((source) => ({
          id: source.id,
          url: source.url,
          domain: source.domain,
          title: source.title,
        })),
      },
    };
  }

  private async *streamGeminiReply(
    sessionId: string,
    userId: string,
    content: string,
  ): AsyncGenerator<ChatStreamEvent> {
    const [context, history] = await Promise.all([
      this.contextBuilder.forChat(userId),
      this.getRecentHistoryForPrompt(sessionId),
    ]);

    const messages: ModelMessage[] = [...history, { role: 'user', content }];

    const result = streamText({
      model: this.aiConfig.chatModel(),
      system: buildChatSystemPrompt(context),
      messages,
    });

    let full = '';
    for await (const chunk of result.textStream) {
      full += chunk;
      yield { type: 'token', data: { text: chunk } };
    }

    // streamText 완료 후 usage 확인 (AI SDK v6: PromiseLike)
    let streamUsage: { inputTokens?: number; outputTokens?: number } | null =
      null;
    try {
      streamUsage = await result.usage;
    } catch {
      // usage 미노출 / 모델 미지원 — totalTokens는 null로 둔다.
    }
    let totalTokens = sumUsage(streamUsage);

    let cardsPayload: ChatCardsPayload = { cards: [], sources: [] };
    try {
      // AI SDK v6: generateText + Output.object 으로 구조화 출력.
      const extraction = await generateText({
        model: this.aiConfig.chatModel(),
        system: CHAT_CARDS_SYSTEM_PROMPT,
        prompt: full,
        experimental_output: Output.object({ schema: ChatCardsSchema }),
      });
      cardsPayload = extraction.experimental_output;
      totalTokens += sumUsage(extraction.usage);
    } catch (err) {
      // 카드 추출 실패해도 본문은 보낸다 — 사용자 경험 저하 최소화.
      this.logger.warn(`cards extraction failed: ${(err as Error).message}`);
    }

    const assistant = await this.saveAssistant({
      sessionId,
      content: full,
      cards: cardsPayload.cards,
      sources: cardsPayload.sources,
      tokensUsed: totalTokens || null,
    });

    yield {
      type: 'done',
      data: {
        messageId: assistant.id,
        content: full,
        cards: assistant.cards.map((card) => ({
          id: card.id,
          order: card.order,
          title: card.title,
          body: card.body,
          actionType: card.actionType,
          actionPayload:
            card.actionPayload === null
              ? null
              : (card.actionPayload as Record<string, unknown>),
        })),
        sources: assistant.sourceLinks.map((source) => ({
          id: source.id,
          url: source.url,
          domain: source.domain,
          title: source.title,
        })),
      },
    };
  }

  private async saveAssistant(input: {
    sessionId: string;
    content: string;
    cards: Array<{ title: string; body: string }>;
    sources: Array<{ url: string; domain: string; title: string | null }>;
    tokensUsed?: number | null;
  }): Promise<MessageWithRelations> {
    return this.prisma.chatMessage.create({
      data: {
        sessionId: input.sessionId,
        role: ChatRole.assistant,
        content: input.content,
        tokensUsed: input.tokensUsed ?? null,
        cards: input.cards.length
          ? {
              create: input.cards.map((card, index) => ({
                order: index,
                title: card.title,
                body: card.body,
              })),
            }
          : undefined,
        sourceLinks: input.sources.length
          ? {
              create: input.sources.map((source) => ({
                url: source.url,
                domain: source.domain,
                title: source.title,
              })),
            }
          : undefined,
      },
      include: { cards: true, sourceLinks: true },
    });
  }

  private async getRecentHistoryForPrompt(
    sessionId: string,
  ): Promise<ModelMessage[]> {
    const recent = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { sentAt: 'desc' },
      take: RECENT_HISTORY_FOR_PROMPT + 1, // +1 = 방금 저장한 user 메시지
    });
    // ModelMessage (서버→LLM 호출 입력) shape — UIMessage가 아니므로 `content` 필드가 정답
    // (AI SDK v6 ModelMessage spec). Prisma row(`row.content`)를 그대로 매핑.
    return recent
      .reverse()
      .slice(0, -1) // 마지막 user row는 streamText에서 별도 추가
      .map((row) => ({
        role: row.role === ChatRole.user ? 'user' : 'assistant',
        content: row.content,
      }));
  }

  private async getOrCreateSession(userId: string) {
    const existing = await this.prisma.chatSession.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    return this.prisma.chatSession.create({
      data: { userId },
    });
  }
}

function sumUsage(
  usage: { inputTokens?: number; outputTokens?: number } | null | undefined,
): number {
  if (!usage) return 0;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

function splitForStreaming(text: string): string[] {
  // 문장 종결 부호 기준으로 분할. 너무 짧은 조각은 합쳐서 자연스럽게.
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let buffer = '';
  for (const piece of parts) {
    buffer += piece;
    if (buffer.length >= 12) {
      out.push(buffer);
      buffer = '';
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toChatMessage(row: MessageWithRelations): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sentAt: row.sentAt.toISOString(),
    cards: row.cards
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((card) => ({
        id: card.id,
        order: card.order,
        title: card.title,
        body: card.body,
        actionType: card.actionType,
        actionPayload:
          card.actionPayload === null
            ? null
            : (card.actionPayload as Record<string, unknown>),
      })),
    sources: row.sourceLinks.map((source) => ({
      id: source.id,
      url: source.url,
      domain: source.domain,
      title: source.title,
    })),
  };
}
