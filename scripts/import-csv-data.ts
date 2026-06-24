/**
 * CSV → DB 일회성 임포트 스크립트.
 *
 * 입력 위치: umbrella(`yougabell/docs/seed-data/`)에 놓인 다음 2개 파일.
 *   - [youth] 워킹맘 MVP 데이터 가공 - 마일스톤 데이터.csv
 *   - [youth] 워킹맘 MVP 데이터 가공 - 미션 데이터.csv   ← 통합본(유일한 미션 소스)
 *
 * ※ 개별 운영자 시트(손서현/오유현/김성훈)는 통합본으로 흡수됨 → 참조용 보관, import 안 함.
 *   개별 + 통합 동시 적재가 과거 945 중복의 원인이었음 (docs/seed-data/README.md 참조).
 *
 * 1. wipe (mission + milestone deleteMany — cascade로 sources/tags 정리)
 * 2. MilestoneCategory 4종(social/language/cognitive/physical) upsert — CDC Act Early 발달 영역 (docs/features/20260523-roadmap.md)
 * 3. 마일스톤 wide → long 변환 + 카테고리별 인접 시점 cover (ageMonthsFrom = 직전 시점)
 * 4. 통합본 미션 → Mission + MissionSource insert
 *
 * 실행 (워크스페이스 루트에서):
 *   `cd yougabell-api && pnpm exec ts-node scripts/import-csv-data.ts`
 * 워크스페이스 mono-clone 가정: yougabell-api/scripts/ 기준 ../../yougabell/docs/seed-data/
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SEED_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'yougabell',
  'docs',
  'seed-data',
);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

/**
 * GrowthStage 시드 — 0~60개월을 4단계로 cover.
 * 출처: Erikson 심리사회 발달 단계 + Piaget 인지 발달 + 임신육아종합포털 아이사랑 월령별 가이드.
 * docs/schema/04-roadmap.md의 GrowthStage 정의 ("월령 그룹 라벨")와 디자인 노드 851:5028에 맞춤.
 */
const GROWTH_STAGES = [
  {
    id: 'trust-attachment',
    name: '신뢰·애착기',
    ageMonthsFrom: 0,
    ageMonthsTo: 6,
    summary:
      '감각과 반사로 세상을 처음 만나는 시기. 양육자와의 안정된 애착이 평생의 정서·인지 기반이 됩니다.',
  },
  {
    id: 'sensory-discovery',
    name: '감각 탐색',
    ageMonthsFrom: 6,
    ageMonthsTo: 18,
    summary:
      '양육자를 안전 기지 삼아 주변을 적극 탐색합니다. 대상 영속성·첫 단어·서기와 걷기가 등장합니다.',
  },
  {
    id: 'self-formation',
    name: '자아 형성기',
    ageMonthsFrom: 18,
    ageMonthsTo: 36,
    summary:
      '"나"라는 인식이 자리잡고 독립적으로 행동하려 합니다. 자율성과 의지가 빠르게 자라며 "내가 할래!"가 자주 들립니다.',
  },
  {
    id: 'emotional-independence',
    name: '정서적 독립기',
    ageMonthsFrom: 36,
    ageMonthsTo: 60,
    summary:
      '스스로 계획하고 시작하는 주도성이 발현됩니다. 또래 놀이로 사회성·감정 조절·역할놀이가 깊어집니다.',
  },
];

/**
 * CDC Act Early 발달 영역 4종.
 * 구 5종(emotion/language/cognition/physical/tip)에서 전환 — 기획 문서 §3.1 결정 2026-05-23.
 * 라벨·아이콘은 Figma `2516:5394` 외 카테고리 카드 노드 기준.
 */
const CATEGORIES = [
  {
    id: 'social',
    label: '사회성',
    iconKey: 'groups',
    color: '#FFF1D6',
    displayOrder: 0,
  },
  {
    id: 'language',
    label: '언어',
    iconKey: 'dictionary',
    color: '#E5ECFF',
    displayOrder: 1,
  },
  {
    id: 'cognitive',
    label: '인지',
    iconKey: 'psychology_alt',
    color: '#EFE4FF',
    displayOrder: 2,
  },
  {
    id: 'physical',
    label: '신체',
    iconKey: 'barefoot',
    color: '#D6F5EC',
    displayOrder: 3,
  },
];

/**
 * CSV의 카테고리 텍스트(레이블 또는 slug)를 4종 신규 slug로 매핑.
 * 구 데이터의 emotion/감정/사회성·감정 → social, cognition → cognitive로 흡수.
 * "tip" / "그 외" 텍스트는 null 반환 → 호출부에서 row skip.
 */
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

/**
 * CSV "아이 나이" 컬럼 → 개월수.
 * - 단순 정수(2, 12, 30, 60): 그대로 개월수
 * - 0.x 표기(0.16): x*100 — 운영자 가이드 "16개월 -> 0.16"
 */
function toAgeMonths(raw?: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^0\.\d+$/.test(trimmed)) {
    const decimal = parseFloat(trimmed);
    return Math.round(decimal * 100);
  }
  const m = trimmed.match(/^\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (!Number.isFinite(n) || n < 0 || n > 120) return null;
  return n;
}

function readCsv(filename: string): string[][] {
  const file = path.join(SEED_DIR, filename);
  const raw = readFileSync(file, 'utf-8');
  return parse(raw, {
    skip_empty_lines: false,
    relax_column_count: true,
  }) as string[][];
}

async function seedCategories() {
  for (const c of CATEGORIES) {
    await prisma.milestoneCategory.upsert({
      where: { id: c.id },
      create: c,
      update: c,
    });
  }
  // CDC 4영역 외 orphan row(구 emotion/cognition/tip 등) 정리.
  // Mission/Milestone는 wipe()로 이미 비웠으므로 FK 참조 없음.
  const validIds = CATEGORIES.map((c) => c.id);
  const orphans = await prisma.milestoneCategory.deleteMany({
    where: { id: { notIn: validIds } },
  });
  console.log(
    `✓ categories upserted: ${CATEGORIES.length} (orphan deleted: ${orphans.count})`,
  );
}

async function seedGrowthStages() {
  for (const s of GROWTH_STAGES) {
    await prisma.growthStage.upsert({
      where: { id: s.id },
      create: s,
      update: s,
    });
  }
  console.log(`✓ growth stages upserted: ${GROWTH_STAGES.length}`);
}

async function importMilestones() {
  const rows = readCsv('[youth] 워킹맘 MVP 데이터 가공 - 마일스톤 데이터.csv');
  // 헤더는 index 2. 컬럼:
  //   0:아이 나이(그룹 라벨)  1:월별  2:사회성  3:언어  4:인지  5:신체  6:(deprecated tip — 무시)  7:자료 출처
  // 구 시드의 "그 외 (Tip)" 컬럼은 CDC 4영역 체계로 전환하며 폐기 (기획 문서 §3.1 결정).
  const CAT_COLS = [
    { idx: 2, slug: 'social' },
    { idx: 3, slug: 'language' },
    { idx: 4, slug: 'cognitive' },
    { idx: 5, slug: 'physical' },
  ];

  // 1단계: CSV에서 모든 마일스톤 추출
  type Item = {
    categoryId: string;
    ageMonths: number;
    description: string;
    citation?: string;
  };
  const items: Item[] = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const ageMonths = toAgeMonths(row[1]);
    if (ageMonths === null) continue;
    const citation = row[7]?.trim();
    for (const { idx, slug } of CAT_COLS) {
      const desc = row[idx]?.trim();
      if (!desc) continue;
      items.push({
        categoryId: slug,
        ageMonths,
        description: desc,
        citation: citation || undefined,
      });
    }
  }

  // 2단계: 카테고리별 distinct ageMonths 정렬 → 인접 시점 cover 매핑
  // CSV는 단일 시점("2개월", "4개월", ...)이지만 그대로 두면 사이 월령(예: 3개월)이 비게 됨.
  // 따라서 각 마일스톤의 ageMonthsFrom = 직전 시점(첫 시점은 0), ageMonthsTo = 현재 시점.
  // 예: emotion 카테고리 시점이 [2, 4, 6, 9, ...]라면
  //     2개월 마일스톤 → from=0, to=2
  //     4개월         → from=2, to=4
  //     6개월         → from=4, to=6
  //     9개월         → from=6, to=9 ...
  const byCat = new Map<string, number[]>();
  for (const it of items) {
    if (!byCat.has(it.categoryId)) byCat.set(it.categoryId, []);
    const arr = byCat.get(it.categoryId)!;
    if (!arr.includes(it.ageMonths)) arr.push(it.ageMonths);
  }
  for (const arr of byCat.values()) arr.sort((a, b) => a - b);

  let count = 0;
  for (const it of items) {
    const ages = byCat.get(it.categoryId)!;
    const idx = ages.indexOf(it.ageMonths);
    const from = idx === 0 ? 0 : ages[idx - 1];
    const to = it.ageMonths;
    await prisma.milestone.create({
      data: {
        categoryId: it.categoryId,
        ageMonthsFrom: from,
        ageMonthsTo: to,
        description: it.description,
        sources: it.citation
          ? { create: [{ citation: it.citation }] }
          : undefined,
      },
    });
    count++;
  }
  console.log(`✓ milestones imported: ${count}`);
}

type MissionMap = {
  ageIdx: number;
  shortIdx: number;
  descIdx: number;
  durIdx: number;
  effectIdx: number;
  tagIdx: number;
  srcIdx: number;
  goalIdx?: number;
};

async function importMissionsFile(
  filename: string,
  headerRowIdx: number,
  map: MissionMap,
  label: string,
) {
  const rows = readCsv(filename);
  let count = 0;
  let skipped = 0;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const ageMonths = toAgeMonths(row[map.ageIdx]);
    const shortTitle = row[map.shortIdx]?.trim();
    const description = row[map.descIdx]?.trim();
    const effect = row[map.effectIdx]?.trim();
    const dur = toMinutes(row[map.durIdx]);
    const category = mapCategory(row[map.tagIdx]);
    const citation = row[map.srcIdx]?.trim();
    const goal =
      map.goalIdx !== undefined ? row[map.goalIdx]?.trim() : undefined;

    if (!shortTitle || !description || !effect || dur === null || !category) {
      skipped++;
      continue;
    }

    await prisma.mission.create({
      data: {
        categoryId: category,
        title: shortTitle,
        shortTitle,
        description,
        durationMinutes: dur,
        effect,
        // 1차 insert는 단일 시점 (min=max=ageMonths).
        // 2차 post-process(postProcessMissionRanges)에서 카테고리별로 인접 시점 cover로 보정.
        recommendedAgeMonthsMin: ageMonths ?? undefined,
        recommendedAgeMonthsMax: ageMonths ?? undefined,
        goal: goal || undefined,
        sources: citation ? { create: [{ citation }] } : undefined,
      },
    });
    count++;
  }
  console.log(`✓ ${label}: ${count} missions imported (skipped: ${skipped})`);
}

/**
 * Mission age range를 Milestone import와 동일한 패턴으로 보정.
 * 카테고리별 distinct max 정렬 → 각 row의 min = 직전 체크포인트 (첫 행은 0).
 *
 * 예: physical 카테고리 max 목록 [2, 4, 6, 9, ...]
 *   - max=2 → min=0  (0·1·2개월 cover)
 *   - max=4 → min=2  (2·3·4)
 *   - max=6 → min=4  (4·5·6)
 *   ...
 *
 * 이로써 5·7·8·10·11·13·14개월 등 비-체크포인트 사용자도 미션 매칭됨.
 */
async function postProcessMissionRanges() {
  const categories = await prisma.mission.findMany({
    distinct: ['categoryId'],
    select: { categoryId: true },
  });
  let updated = 0;
  for (const { categoryId } of categories) {
    const maxRows = await prisma.mission.findMany({
      where: { categoryId, recommendedAgeMonthsMax: { not: null } },
      distinct: ['recommendedAgeMonthsMax'],
      select: { recommendedAgeMonthsMax: true },
      orderBy: { recommendedAgeMonthsMax: 'asc' },
    });
    const maxes = maxRows
      .map((row) => row.recommendedAgeMonthsMax)
      .filter((value): value is number => value !== null);

    for (let i = 0; i < maxes.length; i++) {
      const max = maxes[i];
      const min = i === 0 ? 0 : maxes[i - 1];
      const result = await prisma.mission.updateMany({
        where: { categoryId, recommendedAgeMonthsMax: max },
        data: { recommendedAgeMonthsMin: min },
      });
      updated += result.count;
    }
  }
  console.log(
    `✓ mission age ranges post-processed: ${updated} rows across ${categories.length} categories`,
  );
}

async function wipe() {
  // cascade로 MissionTag·MissionSource·MilestoneSource까지 정리.
  // MissionExecution은 dev에 비어있다고 가정 (실행 기록 있으면 FK 제약으로 실패 → manual cleanup).
  await prisma.mission.deleteMany();
  await prisma.milestone.deleteMany();
  console.log('✓ wiped milestones + missions');
}

async function main() {
  console.log('===== CSV import =====');
  await wipe();
  await seedCategories();
  await seedGrowthStages();
  await importMilestones();

  // 통합 미션 데이터 — 유일한 미션 소스 (구글 시트 480).
  // 개별 운영자 시트(손서현/오유현/김성훈)는 이 통합본으로 흡수됨 → 참조용으로만 보관, import 안 함.
  //   (개별 + 통합 동시 적재가 과거 945 중복의 원인. docs/seed-data/README.md 참조.)
  // 헤더 idx 2 (실제 헤더 위치): 아이나이=0, 목표=1, 시간=2, 미션요약=3, 미션상세=4, 효과=5, 카테고리=6, 출처=7
  await importMissionsFile(
    '[youth] 워킹맘 MVP 데이터 가공 - 미션 데이터.csv',
    2,
    {
      ageIdx: 0,
      goalIdx: 1,
      durIdx: 2,
      shortIdx: 3,
      descIdx: 4,
      effectIdx: 5,
      tagIdx: 6,
      srcIdx: 7,
    },
    '통합 미션',
  );

  // mission import 완료 후, 카테고리별 인접 시점 cover로 min 보정.
  // 단일 시점만 cover하면 5·7·8개월 등 비-체크포인트 사용자에게 미션 0건 매칭됨.
  await postProcessMissionRanges();

  console.log('===== done =====');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
