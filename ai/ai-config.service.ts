import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * 기획 docs/features/20260525-ai-integration.md §4.1.
 * - provider: Gemini (@ai-sdk/google)
 * - chat 모델: AI_CHAT_MODEL (기본 gemini-2.5-flash)
 * - report 모델: AI_REPORT_MODEL (기본 gemini-2.5-flash)
 *
 * GOOGLE_GENERATIVE_AI_API_KEY 미설정 시 isEnabled=false →
 * 호출부는 mock 응답 fallback (Phase 1 동작 유지).
 */
@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);
  private readonly provider: ReturnType<typeof createGoogleGenerativeAI> | null;

  readonly chatModelId: string;
  readonly reportModelId: string;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    this.chatModelId = process.env.AI_CHAT_MODEL?.trim() || 'gemini-2.5-flash';
    this.reportModelId =
      process.env.AI_REPORT_MODEL?.trim() || 'gemini-2.5-flash';

    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_GENERATIVE_AI_API_KEY 미설정 — chat은 mock 응답으로 fallback.',
      );
      this.provider = null;
      return;
    }

    this.provider = createGoogleGenerativeAI({ apiKey });
  }

  get isEnabled(): boolean {
    return this.provider !== null;
  }

  chatModel(): LanguageModel {
    if (!this.provider) {
      throw new Error('AI provider not configured.');
    }
    return this.provider(this.chatModelId);
  }

  reportModel(): LanguageModel {
    if (!this.provider) {
      throw new Error('AI provider not configured.');
    }
    return this.provider(this.reportModelId);
  }
}
