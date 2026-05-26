import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { AiConfigService } from './ai-config.service';

/**
 * Gemini gemini-embedding-001 (matryoshka — 768d 출력) — chat 질문·knowledge chunk 임베딩.
 * 기획 docs/features/20260525-ai-integration.md Phase 4 결정.
 *
 * GOOGLE_GENERATIVE_AI_API_KEY 미설정 시 사용 불가 (호출부에서 isEnabled 확인).
 *
 * taskType은 query vs document를 구분해 인코더가 의미적으로 다른 공간을 학습 — 검색 품질 ↑.
 *   - RETRIEVAL_QUERY: 사용자 질문 (한 번)
 *   - RETRIEVAL_DOCUMENT: 인덱스에 들어갈 chunk (다수)
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  static readonly DIMENSIONS = 768;
  static readonly MODEL_ID = 'gemini-embedding-001';

  constructor(private readonly aiConfig: AiConfigService) {}

  get isEnabled(): boolean {
    return this.aiConfig.isEnabled;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embedOne(text, 'RETRIEVAL_QUERY');
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embedBatch(texts, 'RETRIEVAL_DOCUMENT');
  }

  async embedOne(
    text: string,
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY',
  ): Promise<number[]> {
    if (!this.aiConfig.isEnabled) {
      throw new Error('Embedding provider not configured.');
    }
    const result = await embed({
      model: google.embedding(EmbeddingService.MODEL_ID),
      value: text,
      providerOptions: {
        google: {
          outputDimensionality: EmbeddingService.DIMENSIONS,
          taskType,
        },
      },
    });
    return result.embedding;
  }

  async embedBatch(
    texts: string[],
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.aiConfig.isEnabled) {
      throw new Error('Embedding provider not configured.');
    }
    const result = await embedMany({
      model: google.embedding(EmbeddingService.MODEL_ID),
      values: texts,
      providerOptions: {
        google: {
          outputDimensionality: EmbeddingService.DIMENSIONS,
          taskType,
        },
      },
    });
    return result.embeddings;
  }
}
