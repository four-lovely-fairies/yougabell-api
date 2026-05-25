import { Injectable } from '@nestjs/common';
import { ChatRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MOCK_ASSISTANT_REPLY } from './chat.mock-reply';
import {
  CHAT_RECENT_MESSAGES_LIMIT,
  type ChatMessage,
  type ChatResponse,
  type SendChatMessageResponse,
} from './chat.types';

type MessageWithRelations = Prisma.ChatMessageGetPayload<{
  include: { cards: true; sourceLinks: true };
}>;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Phase 1: 사용자 메시지 저장 + 고정 mock 응답 저장.
   * Phase 2에서 Gemini streamText로 교체.
   */
  async sendMessage(
    userId: string,
    content: string,
  ): Promise<SendChatMessageResponse> {
    const session = await this.getOrCreateSession(userId);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.user,
        content,
      },
      include: { cards: true, sourceLinks: true },
    });

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.assistant,
        content: MOCK_ASSISTANT_REPLY.content,
        cards: {
          create: MOCK_ASSISTANT_REPLY.cards.map((card, index) => ({
            order: index,
            title: card.title,
            body: card.body,
          })),
        },
      },
      include: { cards: true, sourceLinks: true },
    });

    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage: toChatMessage(userMessage),
      assistantMessage: toChatMessage(assistantMessage),
    };
  }

  async deleteChat(userId: string): Promise<void> {
    await this.prisma.chatSession.deleteMany({ where: { userId } });
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
