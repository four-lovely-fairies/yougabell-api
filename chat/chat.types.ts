export type ChatRole = 'user' | 'assistant';

export type ChatMessageCard = {
  id: string;
  order: number;
  title: string;
  body: string;
  actionType: 'none' | 'start_mission' | 'open_link' | 'follow_up' | null;
  actionPayload: Record<string, unknown> | null;
};

export type ChatMessageSource = {
  id: string;
  url: string;
  domain: string;
  title: string | null;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sentAt: string; // ISO
  cards: ChatMessageCard[];
  sources: ChatMessageSource[];
};

export type ChatSession = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatResponse = {
  session: ChatSession | null;
  messages: ChatMessage[];
};

export const CHAT_RECENT_MESSAGES_LIMIT = 50;

export type ChatStreamEvent =
  | { type: 'token'; data: { text: string } }
  | {
      type: 'done';
      data: {
        messageId: string;
        content: string;
        cards: ChatMessageCard[];
        sources: ChatMessageSource[];
      };
    }
  | { type: 'error'; data: { message: string } };
