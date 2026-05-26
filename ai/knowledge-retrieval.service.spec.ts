import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmbeddingService } from './embedding.service';
import {
  KnowledgeRetrievalService,
  type RetrievedChunk,
} from './knowledge-retrieval.service';

const enabledEmbedding = (vec: number[]) =>
  ({
    isEnabled: true,
    embedQuery: () => Promise.resolve(vec),
  }) as unknown as EmbeddingService;

const disabledEmbedding = {
  isEnabled: false,
  embedQuery: () => Promise.reject(new Error('disabled')),
} as unknown as EmbeddingService;

const failingEmbedding = {
  isEnabled: true,
  embedQuery: () => Promise.reject(new Error('boom')),
} as unknown as EmbeddingService;

void describe('KnowledgeRetrievalService.retrieve', () => {
  void it('returns empty array when embedding provider is disabled', async () => {
    const prisma = createPrismaStub({ rawResult: [] });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      disabledEmbedding,
    );

    const result = await service.retrieve('잠자리', 5);

    assert.deepEqual(result, []);
    assert.equal(prisma._calls.queryRaw, 0, 'should not run pgvector query');
  });

  void it('returns empty array when embedding throws', async () => {
    const prisma = createPrismaStub({ rawResult: [] });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      failingEmbedding,
    );

    const result = await service.retrieve('잠자리', 5);

    assert.deepEqual(result, []);
    assert.equal(prisma._calls.queryRaw, 0);
  });

  void it('returns empty array when pgvector query throws', async () => {
    const prisma = createPrismaStub({
      rawResult: new Error('extension missing'),
    });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      enabledEmbedding([0.1, 0.2, 0.3]),
    );

    const result = await service.retrieve('잠자리', 5);

    assert.deepEqual(result, []);
    assert.equal(prisma._calls.queryRaw, 1);
  });

  void it('accepts custom minSimilarity arg (forwarded to SQL filter)', async () => {
    // raw SQL stub은 query를 그대로 실행 안 함 — 단순히 호출 여부 + custom k/minSim 인자가
    // service가 정상 흐름 타는지만 검증. SQL WHERE 필터의 실제 동작은 production 검증 분리.
    const prisma = createPrismaStub({ rawResult: [] });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      enabledEmbedding([0.1, 0.2]),
    );

    const result = await service.retrieve('잠자리', 3, 0.7);

    assert.deepEqual(result, []);
    assert.equal(prisma._calls.queryRaw, 1);
  });

  void it('returns mapped chunks when embedding + pgvector succeed', async () => {
    const rows = [
      {
        chunkId: 'c-1',
        documentId: 'd-1',
        chunkIndex: 0,
        text: '잠자리 루틴...',
        similarity: 0.92,
        source: 'mohw',
        sourceUrl: 'https://www.childcare.go.kr/sleep',
        title: '영유아 수면 루틴',
        license: '공공저작물',
      },
      {
        chunkId: 'c-2',
        documentId: 'd-1',
        chunkIndex: 1,
        text: '잠자리 티켓...',
        similarity: 0.81,
        source: 'mohw',
        sourceUrl: 'https://www.childcare.go.kr/sleep',
        title: '영유아 수면 루틴',
        license: '공공저작물',
      },
    ];
    const prisma = createPrismaStub({ rawResult: rows });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      enabledEmbedding([0.1, 0.2, 0.3]),
    );

    const result = await service.retrieve('잠자리', 5);

    assert.equal(result.length, 2);
    assert.equal(result[0].chunkId, 'c-1');
    assert.equal(result[0].similarity, 0.92);
    assert.equal(result[0].source, 'mohw');
    assert.equal(result[0].sourceUrl, 'https://www.childcare.go.kr/sleep');
  });
});

void describe('KnowledgeRetrievalService.recordRetrievals', () => {
  void it('no-ops when chunks empty', async () => {
    const prisma = createPrismaStub({ rawResult: [] });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      disabledEmbedding,
    );

    await service.recordRetrievals('msg-1', []);

    assert.equal(prisma._calls.retrievalCreateMany, 0);
  });

  void it('inserts retrieval audit rows with rank order', async () => {
    const prisma = createPrismaStub({ rawResult: [] });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      enabledEmbedding([0.1]),
    );
    const chunks: RetrievedChunk[] = [
      makeChunk({ chunkId: 'c-a', similarity: 0.92 }),
      makeChunk({ chunkId: 'c-b', similarity: 0.81 }),
    ];

    await service.recordRetrievals('msg-1', chunks);

    assert.equal(prisma._calls.retrievalCreateMany, 1);
    const arg = prisma._lastRetrievalCreateManyArg!;
    assert.equal(arg.skipDuplicates, true);
    assert.equal(arg.data.length, 2);
    assert.deepEqual(
      arg.data.map((d) => ({ chunkId: d.chunkId, rank: d.rank })),
      [
        { chunkId: 'c-a', rank: 1 },
        { chunkId: 'c-b', rank: 2 },
      ],
    );
  });

  void it('swallows createMany failure (best-effort audit)', async () => {
    const prisma = createPrismaStub({
      rawResult: [],
      retrievalCreateManyError: new Error('db down'),
    });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      enabledEmbedding([0.1]),
    );

    await service.recordRetrievals('msg-1', [makeChunk({ chunkId: 'c-a' })]);

    // Should not throw — assertion is "no error" by reaching this line.
    assert.ok(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeChunk(overrides: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    chunkId: 'c-x',
    documentId: 'd-x',
    chunkIndex: 0,
    text: 'text',
    similarity: 0.5,
    source: 'cdc',
    sourceUrl: null,
    title: 'Title',
    license: 'Public Domain',
    ...overrides,
  };
}

type PrismaStubInstance = {
  $queryRaw: (...args: unknown[]) => Promise<unknown[]>;
  messageRetrieval: {
    createMany: (args: {
      data: Array<{
        messageId: string;
        chunkId: string;
        similarity: number;
        rank: number;
      }>;
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
  };
  _calls: { queryRaw: number; retrievalCreateMany: number };
  _lastRetrievalCreateManyArg: {
    data: Array<{
      messageId: string;
      chunkId: string;
      similarity: number;
      rank: number;
    }>;
    skipDuplicates?: boolean;
  } | null;
};

function createPrismaStub(input: {
  rawResult: unknown[] | Error;
  retrievalCreateManyError?: Error;
}): PrismaStubInstance {
  const calls = { queryRaw: 0, retrievalCreateMany: 0 };
  let lastArg: PrismaStubInstance['_lastRetrievalCreateManyArg'] = null;
  return {
    $queryRaw: () => {
      calls.queryRaw += 1;
      if (input.rawResult instanceof Error) {
        return Promise.reject(input.rawResult);
      }
      return Promise.resolve(input.rawResult);
    },
    messageRetrieval: {
      createMany: (args) => {
        calls.retrievalCreateMany += 1;
        lastArg = args;
        if (input.retrievalCreateManyError) {
          return Promise.reject(input.retrievalCreateManyError);
        }
        return Promise.resolve({ count: args.data.length });
      },
    },
    _calls: calls,
    get _lastRetrievalCreateManyArg() {
      return lastArg;
    },
  } as PrismaStubInstance;
}
