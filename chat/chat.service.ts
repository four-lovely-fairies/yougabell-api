import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  containsSystemPromptLeak,
  extractChoices,
  sanitizeAssistantContent,
} from './chat-sanitize';
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
// 한 응답에서 이어 생성할 최대 세그먼트 수. 5 → 2: 길게 이어 붙이며 답이 수천 자로 늘어나
// "너무 길어서 못 읽겠다"는 VOC가 있었다. 끊긴 문장을 마무리하는 한 번만 허용한다.
const CHAT_MAX_SEGMENTS = 2;
// 이 길이를 넘는 응답은 정상 대화가 아닐 가능성이 높다 (프롬프트 되뱉음 등).
// 차단하지는 않고 경고만 남긴다 — 정상적으로 긴 답변도 있을 수 있으므로.
const CHAT_REPLY_LENGTH_WARN_CHARS = 2000;
// sanitize 결과가 통째로 비었을 때 대신 보여줄 본문.
// 빈 말풍선을 띄우느니 재시도를 안내한다. (i18n 도입 시 locale별 분기 대상)
const CHAT_FALLBACK_REPLY =
  '죄송해요, 답변을 정리하는 중에 문제가 생겼어요. 한 번만 다시 말씀해 주시겠어요?';

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
        // Gemini Flash의 내부 사고(thinking)를 끈다 — 첫 글자까지 기다리는 시간이 줄고
        // 사고 토큰이 출력 상한을 먹어 문장이 끊기는 일도 막는다. (Pro 계열은 0 불가라 Flash만)
        ...(this.aiConfig.chatModelId.includes('flash')
          ? {
              providerOptions: {
                google: { thinkingConfig: { thinkingBudget: 0 } },
              },
            }
          : {}),
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

    // 끝에 붙은 선택지 블록은 본문에서 떼어 follow_up 카드로 보낸다.
    const { body: replyBody, choices } = extractChoices(full);
    full = replyBody;

    // 프롬프트 되뱉음·비정상 길이 감지 — 카드 추출 전에 판정한다.
    const promptLeaked = containsSystemPromptLeak(full);
    if (promptLeaked) {
      this.logger.warn(
        `system prompt leak detected — sessionId=${sessionId}, chars=${full.length}, tokens=${totalTokens}`,
      );
    } else if (full.length > CHAT_REPLY_LENGTH_WARN_CHARS) {
      this.logger.warn(
        `unusually long reply — sessionId=${sessionId}, chars=${full.length}, tokens=${totalTokens}`,
      );
    }

    let cardsPayload: ChatCardsPayload = { cards: [], sources: [] };
    // 누출된 응답에서 뽑은 카드는 전부 지시문 조각이다 — 추출 자체를 건너뛴다.
    // 선택지를 물은 답변(상황 확인)은 행동 카드가 없으므로 추출을 생략한다 — 응답도 빨라진다.
    if (!promptLeaked && choices.length === 0) {
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
    }

    // 출처 링크는 LLM 생성 X → retrieve된 chunks의 sourceUrl만 노출 (환각 차단).
    // LLM이 cards 추출 시 sources를 반환해도 무시.
    const knowledgeSources = mergeKnowledgeSources(retrievedChunks);

    // 카드 추출은 원본 full에서(누출된 행동내용도 카드로 흡수), 저장·표시 본문은 정리본.
    // 정리 결과가 통째로 비면(프롬프트만 뱉은 경우 등) 빈 말풍선 대신 안내 문구로 대체.
    const cleaned = sanitizeAssistantContent(full) || CHAT_FALLBACK_REPLY;

    const assistant = await this.saveAssistant({
      sessionId,
      content: cleaned,
      cards:
        choices.length > 0
          ? choices.map((choice) => ({
              title: choice,
              body: '',
              actionType: 'follow_up' as const,
            }))
          : cardsPayload.cards,
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

  /**
   * AI 답변 피드백("도움이 돼요/안돼요") 저장. 답변 1개당 1행, 다시 누르면 마지막 값으로 갱신.
   * 본인 대화의 assistant 메시지가 아니면 404.
   */
  async setMessageFeedback(
    userId: string,
    messageId: string,
    helpful: boolean,
    comment?: string,
  ): Promise<void> {
    const message = await this.prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        role: ChatRole.assistant,
        session: { userId },
      },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException('피드백을 남길 답변을 찾을 수 없어요.');
    }

    // 아쉬운 점은 "도움이 안돼요"에만 남긴다. 도움이 돼요로 바꾸면 지운다.
    // comment를 안 보낸 요청(버튼만 다시 누름)은 기존 내용을 유지한다.
    const trimmed = comment?.trim();
    const commentData = helpful
      ? { comment: null }
      : comment === undefined
        ? {}
        : { comment: trimmed ? trimmed : null };

    await this.prisma.chatMessageFeedback.upsert({
      where: { messageId },
      create: { messageId, userId, helpful, ...commentData },
      update: { helpful, ...commentData },
    });
  }

  private async saveAssistant(input: {
    sessionId: string;
    content: string;
    cards: Array<{
      title: string;
      body: string;
      actionType?: 'follow_up';
    }>;
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
                ...(card.actionType ? { actionType: card.actionType } : {}),
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
