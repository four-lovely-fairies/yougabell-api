/**
 * CSV → DB 일회성 임포트 스크립트.
 *
 * 입력 위치: umbrella(`yougabell/docs/seed-data/`)에 놓인 다음 5개 파일.
 *   - [youth] 워킹맘 MVP 데이터 가공 - 마일스톤 데이터.csv
 *   - [youth] 워킹맘 MVP 데이터 가공 - 손서현_미션데이터.csv
 *   - [youth] 워킹맘 MVP 데이터 가공 - 오유현_미션데이터.csv
 *   - [youth] 워킹맘 MVP 데이터 가공 - 김성훈_미션 데이터(30개월~5년).csv
 *
 * 1. wipe (mission + milestone deleteMany — cascade로 sources/tags 정리)
 * 2. MilestoneCategory 5종(emotion/language/cognition/physical/tip) upsert
 * 3. 마일스톤 wide → long 변환 + 카테고리별 인접 시점 cover (ageMonthsFrom = 직전 시점)
 * 4. 미션 3개 파일 → Mission + MissionSource insert (운영자별 시트 컬럼 매핑 다름)
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

const CATEGORIES = [
  {
    id: 'emotion',
    label: '사회성·감정',
    iconKey: 'heart',
    color: '#FFB3C7',
    displayOrder: 0,
  },
  {
    id: 'language',
    label: '언어·소통',
    iconKey: 'mic',
    color: '#A4D4FF',
    displayOrder: 1,
  },
  {
    id: 'cognition',
    label: '인지',
    iconKey: 'brain',
    color: '#FFD580',
    displayOrder: 2,
  },
  {
    id: 'physical',
    label: '움직임·신체',
    iconKey: 'run',
    color: '#B5E48C',
    displayOrder: 3,
  },
  {
    id: 'tip',
    label: '팁/그 외',
    iconKey: 'lightbulb',
    color: '#CDB4DB',
    displayOrder: 4,
  },
];

function mapCategory(raw?: string): string | null {
  if (!raw) return null;
  const t = raw.replace(/[#/\s]/g, '').toLowerCase();
  if (/사회|감정|emotion/.test(t)) return 'emotion';
  if (/언어|소통|language/.test(t)) return 'language';
  if (/인지|cognition/.test(t)) return 'cognition';
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
  console.log(`✓ categories upserted: ${CATEGORIES.length}`);
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
  const rows = readCsv(
    '[youth] 워킹맘 MVP 데이터 가공 - 마일스톤 데이터.csv',
  );
  // 헤더는 index 2. 컬럼:
  //   0:아이 나이(그룹 라벨)  1:월별  2:사회성·감정  3:언어·소통  4:인지  5:움직임·신체  6:그 외(Tip)  7:자료 출처
  const CAT_COLS = [
    { idx: 2, slug: 'emotion' },
    { idx: 3, slug: 'language' },
    { idx: 4, slug: 'cognition' },
    { idx: 5, slug: 'physical' },
    { idx: 6, slug: 'tip' },
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
        sources: it.citation ? { create: [{ citation: it.citation }] } : undefined,
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

  // 손서현 — 헤더 idx 2: 아이개월수=0, 태그=1, 시간=2, 키워드=3, 미션=4, 효과=5, 출처=6
  await importMissionsFile(
    '[youth] 워킹맘 MVP 데이터 가공 - 손서현_미션데이터.csv',
    2,
    {
      ageIdx: 0,
      tagIdx: 1,
      durIdx: 2,
      shortIdx: 3,
      descIdx: 4,
      effectIdx: 5,
      srcIdx: 6,
    },
    '손서현',
  );

  // 오유현 — 헤더 idx 6: 아이나이=0, 시간=1, 키워드=2, 미션=3, 효과=4, 태그=5, 출처=6, _=7, 목표=8
  await importMissionsFile(
    '[youth] 워킹맘 MVP 데이터 가공 - 오유현_미션데이터.csv',
    6,
    {
      ageIdx: 0,
      durIdx: 1,
      shortIdx: 2,
      descIdx: 3,
      effectIdx: 4,
      tagIdx: 5,
      srcIdx: 6,
      goalIdx: 8,
    },
    '오유현',
  );

  // 김성훈 — 헤더 idx 7: 아이나이=0, 목표=1, 부모유형=2, 시간=3, 키워드=4, 미션=5, 효과=6, 태그=7, 출처=8
  await importMissionsFile(
    '[youth] 워킹맘 MVP 데이터 가공 - 김성훈_미션 데이터(30개월~5년).csv',
    7,
    {
      ageIdx: 0,
      goalIdx: 1,
      durIdx: 3,
      shortIdx: 4,
      descIdx: 5,
      effectIdx: 6,
      tagIdx: 7,
      srcIdx: 8,
    },
    '김성훈',
  );

  console.log('===== done =====');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
