import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  similarity: number;
  source: string;
  sourceUrl: string | null;
  title: string;
  license: string;
};

/**
 * pgvector 코사인 유사도 검색 — 챗 system prompt 합성·주간 리포트 보조.
 * 기획 docs/features/20260525-ai-integration.md Phase 4.
 *
 * cosine distance 연산자(<=>): 0=동일, 2=정반대.
 * similarity = 1 - distance → 1=동일, 0=무관.
 *
 * MIN_SIMILARITY: 양육 무관 질문(예: 갈비찜 레시피)에도 top-k chunks가 강제 매칭되어
 * sourceLink에 misleading 출처가 노출되던 문제 차단 (Phase 5 검증 발견 이슈).
 * dev 실측: HIT 0.650~0.818 / MISS 0.515~0.521 → 0.55 임계값으로 명확 분리.
 */
const MIN_SIMILARITY = 0.55;

@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  get isEnabled(): boolean {
    return this.embedding.isEnabled;
  }

  async retrieve(
    query: string,
    k = 5,
    minSimilarity = MIN_SIMILARITY,
  ): Promise<RetrievedChunk[]> {
    if (!this.embedding.isEnabled) return [];

    let queryVec: number[];
    try {
      // RETRIEVAL_QUERY taskType — query·document를 다른 공간에 매핑해 정확도 ↑
      queryVec = await this.embedding.embedQuery(query);
    } catch (err) {
      this.logger.warn(
        `query embedding failed: ${(err as Error).message} — RAG 빈 결과로 진행`,
      );
      return [];
    }

    // pgvector parameter는 '[1,2,...]' 문자열 + ::vector 캐스트.
    const vecStr = `[${queryVec.join(',')}]`;
    try {
      // SQL 단계에서 임계값 필터 — pgvector 인덱스 활용 + 네트워크 전송량 감소.
      const rows = await this.prisma.$queryRaw<
        Array<{
          chunkId: string;
          documentId: string;
          chunkIndex: number;
          text: string;
          similarity: number;
          source: string;
          sourceUrl: string | null;
          title: string;
          license: string;
        }>
      >(Prisma.sql`
        SELECT
          c.id           AS "chunkId",
          c."documentId" AS "documentId",
          c."chunkIndex" AS "chunkIndex",
          c.text         AS text,
          (1 - (c.embedding <=> ${vecStr}::vector))::float AS similarity,
          d.source       AS source,
          d."sourceUrl"  AS "sourceUrl",
          d.title        AS title,
          d.license      AS license
        FROM "KnowledgeChunk" c
        JOIN "KnowledgeDocument" d ON d.id = c."documentId"
        WHERE c.embedding IS NOT NULL
          AND (1 - (c.embedding <=> ${vecStr}::vector)) >= ${minSimilarity}
        ORDER BY c.embedding <=> ${vecStr}::vector
        LIMIT ${k}
      `);
      return rows;
    } catch (err) {
      this.logger.warn(
        `pgvector retrieval failed: ${(err as Error).message} — RAG 빈 결과로 진행`,
      );
      return [];
    }
  }

  /**
   * Assistant 응답 저장 후 retrieval 감사 row 일괄 기록.
   * 실패해도 응답 자체는 영향 없음 (best-effort).
   */
  async recordRetrievals(
    messageId: string,
    chunks: RetrievedChunk[],
  ): Promise<void> {
    if (chunks.length === 0) return;
    try {
      await this.prisma.messageRetrieval.createMany({
        data: chunks.map((chunk, index) => ({
          messageId,
          chunkId: chunk.chunkId,
          similarity: chunk.similarity,
          rank: index + 1,
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      this.logger.warn(`recordRetrievals failed: ${(err as Error).message}`);
    }
  }
}
