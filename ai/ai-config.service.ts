import { Injectable } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * 기획 docs/features/20260525-ai-integration.md §4.1.
 * - provider: Gemini (@ai-sdk/google)
 * - chat 모델: AI_CHAT_MODEL (기본 gemini-2.5-flash)
 * - report 모델: AI_REPORT_MODEL (기본 gemini-2.5-flash)
 */
@Injectable()
export class AiConfigService {
  private readonly provider: ReturnType<typeof createGoogleGenerativeAI>;

  readonly chatModelId: string;
  readonly reportModelId: string;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    this.chatModelId = process.env.AI_CHAT_MODEL?.trim() || 'gemini-2.5-flash';
    this.reportModelId =
      process.env.AI_REPORT_MODEL?.trim() || 'gemini-2.5-flash';

    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required.');
    }

    this.provider = createGoogleGenerativeAI({ apiKey });
  }

  get isEnabled(): boolean {
    return true;
  }

  chatModel(): LanguageModel {
    return this.provider(this.chatModelId);
  }

  reportModel(): LanguageModel {
    return this.provider(this.reportModelId);
  }
}
