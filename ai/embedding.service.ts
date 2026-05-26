import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { AiConfigService } from './ai-config.service';

/**
 * Gemini text-embedding-004 (768d) — chat 질문·knowledge chunk 임베딩.
 * 기획 docs/features/20260525-ai-integration.md Phase 4 결정.
 *
 * GOOGLE_GENERATIVE_AI_API_KEY 미설정 시 사용 불가 (호출부에서 isEnabled 확인).
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  static readonly DIMENSIONS = 768;
  static readonly MODEL_ID = 'text-embedding-004';

  constructor(private readonly aiConfig: AiConfigService) {}

  get isEnabled(): boolean {
    return this.aiConfig.isEnabled;
  }

  async embedOne(text: string): Promise<number[]> {
    if (!this.aiConfig.isEnabled) {
      throw new Error('Embedding provider not configured.');
    }
    const result = await embed({
      model: google.textEmbeddingModel(EmbeddingService.MODEL_ID),
      value: text,
    });
    return result.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.aiConfig.isEnabled) {
      throw new Error('Embedding provider not configured.');
    }
    const result = await embedMany({
      model: google.textEmbeddingModel(EmbeddingService.MODEL_ID),
      values: texts,
    });
    return result.embeddings;
  }
}
