/**
 * 미션 데이터를 통합본(구글 시트 480)에 맞춰 정리하는 일회성 스크립트.
 *
 * 배경:
 *   - import-csv-data.ts가 통합 파일을 headerRowIdx=5(오류, 실제 헤더는 row 2)로 읽어
 *     상단 미션 3개(들어 올려 달래기 / 눈 맞춤 게임 / 다가가서 인사하기)를 건너뜀 → 477만 적재.
 *   - 게다가 개별 운영자 시트(손서현/오유현/김성훈) 468행이 통합본과 별개로 적재됨 → 총 945.
 *
 * 목표 (사용자 확정):
 *   1. 누락 3개를 추가해 통합본 480을 완성.
 *   2. MissionExecution 45건 중 통합본에 깔끔히 연결되는 32건만 보존:
 *      - 16건 이미 통합본(유지) + 16건 동일 미션(twin → 통합본으로 repoint).
 *   3. 통합본에 대응이 없는 개별-전용 실행 13건은 전부 삭제 — 전수 확인 결과
 *      hitedin/emmajenny0426 등 테스터 계정이거나 30초 미만 중도종료 노이즈.
 *      (딸린 MissionFeedback/Keyword는 cascade 정리)
 *   4. 개별 미션 468행 삭제 → 최종 480개.
 *
 * 안전장치:
 *   - 기본 DRY_RUN: 트랜잭션 안에서 전부 수행 후 의도적으로 롤백, 변경 예정 내역만 출력.
 *   - 실제 반영: DRY_RUN=false 환경변수.
 *   - 삭제 대상 미션을 가리키는 실행 잔존 시 즉시 중단(throw).
 *
 * 실행 (워크스페이스 루트 또는 yougabell-api에서):
 *   dry-run:  cd yougabell-api && pnpm exec ts-node scripts/conform-missions-to-480.ts
 *   실제:     cd yougabell-api && DRY_RUN=false pnpm exec ts-node scripts/conform-missions-to-480.ts
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.env.DRY_RUN !== 'false';

const CSV_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'yougabell',
  'docs',
  'seed-data',
  '[youth] 워킹맘 MVP 데이터 가공 - 미션 데이터.csv',
);

// 통합 CSV의 실제 헤더 위치(올바른 값). import-csv-data.ts의 5는 버그.
const HEADER_ROW_IDX = 2;
const COL = {
  age: 0,
  goal: 1,
  dur: 2,
  short: 3,
  desc: 4,
  effect: 5,
  tag: 6,
  src: 7,
};

// 임포트 블록 경계 (createdAt 오름차순 기준, 0-based 인덱스).
//   손서현 157 [0..156] · 오유현 156 [157..312] · 통합 477 [313..789] · 김성훈 155 [790..944]
const CANONICAL_START = 313; // inclusive
const CANONICAL_END = 790; // exclusive (313..789 = 477행)

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/\s+/g, '');
const keyOf = (short: string, cat: string) => `${norm(short)}|${cat}`;

function mapCategory(raw?: string): string | null {
  if (!raw) return null;
  const t = raw.replace(/[#/\s]/g, '').toLowerCase();
  if (/사회|감정|emotion|social/.test(t)) return 'social';
  if (/언어|소통|language/.test(t)) return 'language';
  if (/인지|학습|사고|cognition|cognitive/.test(t)) return 'cognitive';
  if (/신체|움직임|physical/.test(t)) return 'physical';
  return null;
}
function toMinutes(raw?: string): number | null {
  if (!raw) return null;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

class DryRunRollback extends Error {}

async function run() {
  console.log(
    `===== conform-missions-to-480 (${DRY_RUN ? 'DRY-RUN' : '실제 반영'}) =====`,
  );

  // 0. 스냅샷: 현재 미션을 createdAt 순으로 읽어 canonical(통합) 블록 식별
  const all = await prisma.mission.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, shortTitle: true, categoryId: true },
  });
  if (all.length !== 945) {
    console.warn(
      `⚠ 현재 미션 수가 945가 아님(${all.length}). 블록 경계 가정이 어긋날 수 있어 중단.`,
    );
    if (all.length !== 945)
      throw new Error(`unexpected mission count: ${all.length}`);
  }
  const canonical = all.slice(CANONICAL_START, CANONICAL_END); // 477
  const canonicalIds = new Set(canonical.map((m) => m.id));
  const canonicalKey = new Map<string, string>(); // key -> missionId
  for (const m of canonical)
    canonicalKey.set(keyOf(m.shortTitle, m.categoryId), m.id);
  console.log(
    `canonical(통합) 블록: ${canonical.length}행, 고유 key ${canonicalKey.size}`,
  );

  await prisma.$transaction(async (tx) => {
    // 1. 누락 미션 추가 — 통합 CSV(헤더 row 2)에서 canonicalKey에 없는 행을 삽입
    const rows = parse(readFileSync(CSV_PATH, 'utf-8'), {
      skip_empty_lines: false,
      relax_column_count: true,
    }) as string[][];

    const addedIds: string[] = [];
    const addedTitles: string[] = [];
    for (let i = HEADER_ROW_IDX + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.some((c) => c && c.trim())) continue;
      const short = row[COL.short]?.trim();
      const desc = row[COL.desc]?.trim();
      const effect = row[COL.effect]?.trim();
      const dur = toMinutes(row[COL.dur]);
      const cat = mapCategory(row[COL.tag]);
      const goal = row[COL.goal]?.trim();
      const citation = row[COL.src]?.trim();
      if (!short || !desc || !effect || dur === null || !cat) continue;
      if (canonicalKey.has(keyOf(short, cat))) continue; // 이미 통합본에 존재

      const created = await tx.mission.create({
        data: {
          categoryId: cat,
          title: short,
          shortTitle: short,
          description: desc,
          durationMinutes: dur,
          effect,
          // 2개월 사회성 첫 체크포인트 → from=0, to=2 (post-process 패턴과 동일)
          recommendedAgeMonthsMin: 0,
          recommendedAgeMonthsMax: 2,
          goal: goal || undefined,
          sources: citation ? { create: [{ citation }] } : undefined,
        },
        select: { id: true },
      });
      addedIds.push(created.id);
      addedTitles.push(short);
      canonicalKey.set(keyOf(short, cat), created.id); // survivor key에 편입
    }
    console.log(
      `\n[1] 추가된 미션: ${addedIds.length} → ${addedTitles.join(', ')}`,
    );

    // survivor 집합 = canonical(477) + 신규(3)
    const survivorIds = new Set<string>([...canonicalIds, ...addedIds]);

    // 2. 실행 45건 분류: 유지 / twin repoint / 삭제
    const execs = await tx.missionExecution.findMany({
      select: {
        id: true,
        missionId: true,
        mission: { select: { shortTitle: true, categoryId: true } },
      },
    });

    let keepAsIs = 0;
    const repoints: { execId: string; toId: string }[] = [];
    const deleteExecIds: string[] = [];
    for (const e of execs) {
      if (survivorIds.has(e.missionId)) {
        keepAsIs++; // 이미 통합본
        continue;
      }
      // 동일 미션이 통합본에 있음(twin) 또는 신규 추가분과 일치 → repoint
      const toId = canonicalKey.get(
        keyOf(e.mission.shortTitle, e.mission.categoryId),
      );
      if (toId) {
        repoints.push({ execId: e.id, toId });
      } else {
        // 통합본에 대응 없음(개별-전용) → 삭제 (테스터/노이즈 전수 확인 완료)
        deleteExecIds.push(e.id);
      }
    }

    // 삭제 전 cascade 영향 측정
    const fbToDelete = await tx.missionFeedback.count({
      where: { executionId: { in: deleteExecIds } },
    });

    console.log(`\n[2] 실행 ${execs.length}건 분류:`);
    console.log(`    - 유지(이미 통합본): ${keepAsIs}`);
    console.log(`    - twin repoint(동일 미션): ${repoints.length}`);
    console.log(
      `    - 삭제(개별-전용 노이즈): ${deleteExecIds.length} (+피드백 ${fbToDelete} cascade)`,
    );

    for (const r of repoints) {
      await tx.missionExecution.update({
        where: { id: r.execId },
        data: { missionId: r.toId },
      });
    }
    const delExec = await tx.missionExecution.deleteMany({
      where: { id: { in: deleteExecIds } },
    });
    console.log(`    → 삭제 실행: ${delExec.count}`);

    // 3. survivor 외 미션(개별 468) 삭제 — 실행은 이미 전부 옮겨짐
    const toDelete = all.filter((m) => !survivorIds.has(m.id)).map((m) => m.id);
    // 안전 확인: 삭제 대상 미션을 아직 가리키는 실행이 없어야 함
    const stillRef = await tx.missionExecution.count({
      where: { missionId: { in: toDelete } },
    });
    if (stillRef > 0)
      throw new Error(
        `삭제 대상 미션을 가리키는 실행 ${stillRef}건 잔존 — 중단`,
      );

    const del = await tx.mission.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(`\n[3] 개별 미션 삭제: ${del.count}`);

    const finalCount = await tx.mission.count();
    console.log(`\n최종 미션 수: ${finalCount} (기대: 480)`);
    const finalExecs = await tx.missionExecution.count();
    console.log(
      `최종 실행 수: ${finalExecs} (기대: 32 = 유지 16 + repoint 16, 삭제 13)`,
    );

    if (DRY_RUN) {
      console.log('\n※ DRY-RUN — 롤백합니다. 실제 반영하려면 DRY_RUN=false');
      throw new DryRunRollback();
    }
    console.log('\n✓ 커밋 완료');
  });
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    await prisma.$disconnect();
    if (e instanceof DryRunRollback) {
      process.exit(0);
    }
    console.error(e);
    process.exit(1);
  });
