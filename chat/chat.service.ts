import { Injectable, Logger } from '@nestjs/common';
import { ChatRole, Prisma } from '@prisma/client';
import {
  generateText,
  Output,
  streamText,
  type FinishReason,
  type ModelMessage,
} from 'ai';
import { AiConfigService } from '../ai/ai-config.service';
import { ContextBuilderService } from '../ai/context-builder.service';
import {
  KnowledgeRetrievalService,
  type RetrievedChunk,
} from '../ai/knowledge-retrieval.service';
import {
  CHAT_CARDS_SYSTEM_PROMPT,
  ChatCardsSchema,
  type ChatCardsPayload,
} from '../ai/prompts/chat-cards';
import { buildChatSystemPrompt } from '../ai/prompts/chat-system';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHAT_RECENT_MESSAGES_LIMIT,
  type ChatMessage,
  type ChatResponse,
  type ChatStreamEvent,
} from './chat.types';

const RECENT_HISTORY_FOR_PROMPT = 10;

// 생성 호출 1회당 출력 토큰 상한. 이 한도에서 문장이 끊기면 다음 세그먼트로
// "이어서" 생성한다(글자수가 아니라 문장 완결을 기준으로 멈추기 위함).
const CHAT_SEGMENT_MAX_OUTPUT_TOKENS = 1024;
// 한 응답에서 이어 생성할 최대 세그먼트 수 — 폭주 방지 안전 상한.
const CHAT_MAX_SEGMENTS = 5;

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
    private readonly knowledge: KnowledgeRetrievalService,
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
   * Gemini SSE 스트리밍.
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

  private async *streamGeminiReply(
    sessionId: string,
    userId: string,
    content: string,
  ): AsyncGenerator<ChatStreamEvent> {
    const [context, history, retrievedChunks] = await Promise.all([
      this.contextBuilder.forChat(userId),
      this.getRecentHistoryForPrompt(sessionId),
      // Phase 4 RAG — 질문 임베딩 → pgvector top-5 chunk. 실패 시 빈 배열.
      this.knowledge.retrieve(content, 5),
    ]);

    const system = buildChatSystemPrompt(context, retrievedChunks);
    const messages: ModelMessage[] = [...history, { role: 'user', content }];

    // 응답이 출력 토큰 상한에 걸려 "문장 중간에" 끊기면(finishReason 'length'),
    // 같은 턴을 이어서 다시 생성한다 — 큐 방식. 모델이 자연 종료('stop' = 문장
    // 완결)하거나 안전 상한(CHAT_MAX_SEGMENTS)에 도달할 때까지 반복.
    let full = '';
    let totalTokens = 0;
    for (let segment = 0; segment < CHAT_MAX_SEGMENTS; segment += 1) {
      const result = streamText({
        model: this.aiConfig.chatModel(),
        system,
        messages,
        maxOutputTokens: CHAT_SEGMENT_MAX_OUTPUT_TOKENS,
      });

      let segmentText = '';
      for await (const chunk of result.textStream) {
        segmentText += chunk;
        full += chunk;
        yield { type: 'token', data: { text: chunk } };
      }

      // usage 누적 (AI SDK v6: PromiseLike, 미지원 시 무시)
      try {
        totalTokens += sumUsage(await result.usage);
      } catch {
        // usage 미노출 / 모델 미지원 — 누적 생략
      }

      let finishReason: FinishReason = 'stop';
      try {
        finishReason = await result.finishReason;
      } catch {
        // finishReason 미노출 — 자연 종료로 간주
      }
      // 길이로 잘렸고(=문장 미완결) 상한 전이면 직전 출력을 이어받아 계속 생성
      if (finishReason === 'length' && segment < CHAT_MAX_SEGMENTS - 1) {
        messages.push({ role: 'assistant', content: segmentText });
        continue;
      }
      break;
    }

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

    // 출처 링크는 LLM 생성 X → retrieve된 chunks의 sourceUrl만 노출 (환각 차단).
    // LLM이 cards 추출 시 sources를 반환해도 무시.
    const knowledgeSources = mergeKnowledgeSources(retrievedChunks);

    // 카드 추출은 원본 full에서(누출된 행동내용도 카드로 흡수), 저장·표시 본문은 정리본.
    const cleaned = sanitizeAssistantContent(full);

    const assistant = await this.saveAssistant({
      sessionId,
      content: cleaned,
      cards: cardsPayload.cards,
      sources: knowledgeSources,
      tokensUsed: totalTokens || null,
    });

    // Phase 4 감사 row — 어떤 chunk가 인용됐는지 (best-effort).
    if (retrievedChunks.length > 0) {
      void this.knowledge.recordRetrievals(assistant.id, retrievedChunks);
    }

    yield {
      type: 'done',
      data: {
        messageId: assistant.id,
        content: cleaned,
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

/**
 * 같은 KnowledgeDocument에서 여러 chunk를 가져온 경우 sourceUrl이 중복.
 * URL 기준 dedupe + domain 추출 → SourceLink 형태로 변환.
 */
function mergeKnowledgeSources(
  chunks: RetrievedChunk[],
): Array<{ url: string; domain: string; title: string | null }> {
  const out: Array<{ url: string; domain: string; title: string | null }> = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (!chunk.sourceUrl) continue;
    if (seen.has(chunk.sourceUrl)) continue;
    seen.add(chunk.sourceUrl);
    let domain = '';
    try {
      domain = new URL(chunk.sourceUrl).hostname;
    } catch {
      domain = chunk.source;
    }
    out.push({ url: chunk.sourceUrl, domain, title: chunk.title });
  }
  return out;
}

function sumUsage(
  usage: { inputTokens?: number; outputTokens?: number } | null | undefined,
): number {
  if (!usage) return 0;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

/**
 * 모델 본문 누출물 제거 — 프롬프트로 막아도 가끔 새므로 저장·표시 직전 결정적으로 정리.
 * 1) 구조 블록("cards:"·"type:"·"content:"·"items:" 로 시작하는 줄)부터 끝까지 → 제거
 *    (본문 맨 앞에서 시작하는 누출도 포함 — 블록이 본문 전체면 빈 본문이 된다)
 * 2) 코드펜스(```)는 금지 서식 — 펜스 마커만 걷어내고 안의 텍스트는 본문으로 흡수 (한 줄 overflow 방지)
 * 3) 인라인 출처 번호 표기: "[참고 자료 1]", "[참고자료 1, 2]", "[출처 3]" → 제거
 */
export function sanitizeAssistantContent(raw: string): string {
  let text = raw;
  // 구조 블록(cards:/type:/content:/items: 로 시작하는 줄) 누출 제거.
  // 본문 "맨 앞"에서 시작하는 경우(선행 개행 없음)까지 잡도록 `^|\n`로 앵커링하고,
  // 카드 항목 키 `items:`도 마커에 포함한다. 카드는 별도로 추출·렌더되므로
  // 본문에서는 누출만 걷어내며, 블록이 본문 전체면 빈 본문이 된다.
  text = text.replace(
    /(?:^|\n)[ \t]*-?[ \t]*(?:cards|type|title|content|items)[ \t]*:[\s\S]*$/i,
    '',
  );
  // 코드펜스 마커만 제거 (내용 보존). 챗 본문은 코드블록을 쓰지 않음.
  text = text.replace(/```[a-zA-Z0-9]*\n?/g, '');
  text = text.replace(/\s*\[\s*(?:참고\s*자료|참고자료|출처)[^\]]*\]/g, '');
  return text.replace(/[ \t]+\n/g, '\n').trim();
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
