/**
 * Knowledge Base ingestion 스크립트 — RAG (Phase 4).
 * 기획 docs/features/20260525-ai-integration.md §3.3.
 *
 * 입력: umbrella `yougabell/docs/seed-data/knowledge/*.md`
 *   파일명 패턴: <source>__<slug>.md
 *     source ∈ cdc | mohw | internal
 *   파일 frontmatter (YAML 비슷한 단순 key: value):
 *     ---
 *     title: 4개월 발달 마일스톤 (CDC Act Early)
 *     sourceUrl: https://www.cdc.gov/ncbddd/actearly/milestones/milestones-4mo.html
 *     license: Public Domain (CDC)
 *     language: ko
 *     ---
 *     <본문>
 *
 * 흐름:
 *   1. 파일 읽기 → frontmatter + body 분리
 *   2. body를 500 token / overlap 100 단위로 chunk
 *   3. embedBatch로 일괄 임베딩 (Gemini text-embedding-004)
 *   4. KnowledgeDocument upsert (sourceUrl 기준)
 *   5. 기존 chunks 모두 삭제 + 신규 chunks 일괄 insert
 *      (Prisma는 vector 타입 미지원 → raw SQL로 chunk insert)
 *
 * 실행 (워크스페이스 루트에서):
 *   cd yougabell-api && pnpm exec ts-node scripts/ingest-knowledge.ts
 *
 * 사전 조건:
 *   - Supabase 대시보드 SQL editor:  CREATE EXTENSION IF NOT EXISTS vector;
 *   - prisma db push (KnowledgeDocument / KnowledgeChunk / MessageRetrieval 테이블 생성)
 *   - .env 의 GOOGLE_GENERATIVE_AI_API_KEY 설정
 */
import 'dotenv/config';

import { google } from '@ai-sdk/google';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { embedMany } from 'ai';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const KNOWLEDGE_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'yougabell',
  'docs',
  'seed-data',
  'knowledge',
);
const EMBEDDING_MODEL = 'text-embedding-004';
const CHUNK_TARGET_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 100;
const HANGUL_CHARS_PER_TOKEN = 1.3;
const CHUNK_TARGET_CHARS = Math.round(
  CHUNK_TARGET_TOKENS * HANGUL_CHARS_PER_TOKEN,
); // ≈ 650
const CHUNK_OVERLAP_CHARS = Math.round(
  CHUNK_OVERLAP_TOKENS * HANGUL_CHARS_PER_TOKEN,
); // ≈ 130
const EMBED_BATCH_SIZE = 50;

type SourceSlug = 'cdc' | 'mohw' | 'internal';

type Frontmatter = {
  title: string;
  sourceUrl?: string;
  license: string;
  language?: string;
};

type ParsedDocument = {
  source: SourceSlug;
  slug: string;
  frontmatter: Frontmatter;
  body: string;
};

function buildPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

function readKnowledgeFiles(): ParsedDocument[] {
  let files: string[];
  try {
    files = readdirSync(KNOWLEDGE_DIR).filter((file) => file.endsWith('.md'));
  } catch (err) {
    console.error(`KNOWLEDGE_DIR not found: ${KNOWLEDGE_DIR}`);
    throw err;
  }

  const out: ParsedDocument[] = [];
  for (const filename of files) {
    const match = filename.match(/^(cdc|mohw|internal)__(.+)\.md$/);
    if (!match) {
      console.warn(`skip (filename pattern 불일치): ${filename}`);
      continue;
    }
    const [, source, slug] = match;
    const raw = readFileSync(path.join(KNOWLEDGE_DIR, filename), 'utf-8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      console.warn(`skip (frontmatter 누락): ${filename}`);
      continue;
    }
    out.push({
      source: source as SourceSlug,
      slug,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
    });
  }
  return out;
}

function parseFrontmatter(
  raw: string,
): { frontmatter: Frontmatter; body: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const [, fmText, body] = match;
  const meta: Record<string, string> = {};
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  if (!meta.title || !meta.license) return null;
  return {
    frontmatter: {
      title: meta.title,
      sourceUrl: meta.sourceUrl || undefined,
      license: meta.license,
      language: meta.language || 'ko',
    },
    body: body.trim(),
  };
}

/**
 * 문자 길이 기반 chunking — 한글·영문 모두 단순 char count.
 * 토큰 정확 측정은 tiktoken·gemini tokenizer 필요 (의존성 비용 ↑). v1은 근사치.
 */
function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= CHUNK_TARGET_CHARS) return [normalized];

  const out: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_TARGET_CHARS, normalized.length);
    if (end < normalized.length) {
      // 문장 경계(. ! ? 줄바꿈)에서 끊을 수 있으면 그쪽으로.
      const slice = normalized.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('. '),
      );
      if (lastBreak > CHUNK_TARGET_CHARS / 2) {
        end = start + lastBreak + 1;
      }
    }
    out.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
    if (start < 0) start = 0;
  }
  return out.filter((chunk) => chunk.length > 0);
}

async function embedAll(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch,
    });
    out.push(...embeddings);
  }
  return out;
}

async function upsertDocument(
  prisma: PrismaClient,
  parsed: ParsedDocument,
): Promise<string> {
  const existing = parsed.frontmatter.sourceUrl
    ? await prisma.knowledgeDocument.findFirst({
        where: {
          source: parsed.source,
          sourceUrl: parsed.frontmatter.sourceUrl,
        },
      })
    : null;

  if (existing) {
    await prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: {
        title: parsed.frontmatter.title,
        license: parsed.frontmatter.license,
        language: parsed.frontmatter.language ?? 'ko',
        ingestedAt: new Date(),
      },
    });
    return existing.id;
  }

  const created = await prisma.knowledgeDocument.create({
    data: {
      source: parsed.source,
      sourceUrl: parsed.frontmatter.sourceUrl ?? null,
      title: parsed.frontmatter.title,
      license: parsed.frontmatter.license,
      language: parsed.frontmatter.language ?? 'ko',
    },
  });
  return created.id;
}

async function replaceChunks(
  prisma: PrismaClient,
  documentId: string,
  chunks: Array<{ text: string; tokenCount: number; embedding: number[] }>,
): Promise<void> {
  await prisma.knowledgeChunk.deleteMany({ where: { documentId } });

  // Prisma는 vector 컬럼 직접 insert 미지원 → raw SQL.
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vecStr = `[${chunk.embedding.join(',')}]`;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "KnowledgeChunk" (id, "documentId", "chunkIndex", text, "tokenCount", embedding, "createdAt")
      VALUES (gen_random_uuid(), ${documentId}::uuid, ${i}, ${chunk.text}, ${chunk.tokenCount}, ${vecStr}::vector, now())
    `);
  }
}

async function main() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('GOOGLE_GENERATIVE_AI_API_KEY 미설정 — 종료.');
    process.exit(1);
  }
  const prisma = buildPrisma();

  const parsedDocs = readKnowledgeFiles();
  console.log(`✓ 파일 ${parsedDocs.length}건 발견`);

  let totalChunks = 0;
  for (const parsed of parsedDocs) {
    const chunks = chunkText(parsed.body);
    if (chunks.length === 0) {
      console.warn(`skip (chunk 0): ${parsed.source}__${parsed.slug}`);
      continue;
    }
    console.log(
      `${parsed.source}/${parsed.slug} — ${chunks.length} chunks (${parsed.frontmatter.title})`,
    );
    const embeddings = await embedAll(chunks);
    const documentId = await upsertDocument(prisma, parsed);
    await replaceChunks(
      prisma,
      documentId,
      chunks.map((text, idx) => ({
        text,
        // 정확한 token count는 tokenizer 필요 — char 기반 근사로 임시 기록.
        tokenCount: Math.round(text.length / HANGUL_CHARS_PER_TOKEN),
        embedding: embeddings[idx],
      })),
    );
    totalChunks += chunks.length;
  }

  console.log(`✓ 완료: ${parsedDocs.length} docs / ${totalChunks} chunks`);
  await prisma.$disconnect();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
