import { MissionExecutionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toCurrentMissionStatus } from './execution.utils';
import {
  CURRENT_MISSION_SELECT,
  CurrentMissionRow,
  CurrentMissionStatus,
} from './selects';

// 오늘의 추천 놀이 선정.
// 1) 아이 월령·카테고리·추천연령에 맞는 후보 놀이 전체를 모은다.
// 2) 아이별 수행(완료) 횟수를 집계해, **최저 횟수 그룹**만 후보로 남긴다.
//    (0회 우선 → 모두 1회가 되면 1회끼리 → … 최저 숫자 기준으로 균등 소진/로테이션.)
// 3) 같은 그룹 안에서는 서울 날짜 + 아이 id 해시로 결정적 1개 선택 → 같은 날엔 동일,
//    날짜가 바뀌면 그룹 내 로테이션.
export async function findRecommendedMission(
  prisma: PrismaService,
  childId: string,
  ageMonths: number,
  today: Date,
): Promise<CurrentMissionRow | null> {
  // 카탈로그가 커버하는 추천 월령 범위를 벗어난 아이(예: 시드 상한을 넘는 고월령)는
  // 가장 가까운 경계 월령대로 클램프해 추천한다. 범위 안이면 그대로 사용.
  const effectiveAge = await clampAgeToMissionCatalog(prisma, ageMonths);

  const milestones = await prisma.milestone.findMany({
    where: {
      ageMonthsFrom: { lte: effectiveAge },
      ageMonthsTo: { gte: effectiveAge },
    },
    select: { categoryId: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const categoryIds = [
    ...new Set(milestones.map((milestone) => milestone.categoryId)),
  ];

  const candidates = await prisma.mission.findMany({
    where: {
      ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      OR: [
        { recommendedAgeMonthsMin: null },
        { recommendedAgeMonthsMin: { lte: effectiveAge } },
      ],
      AND: [
        {
          OR: [
            { recommendedAgeMonthsMax: null },
            { recommendedAgeMonthsMax: { gte: effectiveAge } },
          ],
        },
      ],
    },
    select: CURRENT_MISSION_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  if (candidates.length === 0) {
    return null;
  }

  // 아이별 놀이 수행(완료) 횟수 집계.
  const counts = await prisma.missionExecution.groupBy({
    by: ['missionId'],
    where: {
      childId,
      status: {
        in: [
          MissionExecutionStatus.completed,
          MissionExecutionStatus.early_completed,
        ],
      },
    },
    _count: { _all: true },
  });
  const countByMission = new Map(
    counts.map((row) => [row.missionId, row._count._all]),
  );

  // 후보별 수행횟수 → 최저 횟수 그룹만 남긴다 (0회 우선, 모두 1이면 1회끼리…).
  const withCount = candidates.map((mission) => ({
    mission,
    count: countByMission.get(mission.id) ?? 0,
  }));
  const minCount = Math.min(...withCount.map((entry) => entry.count));
  const pool = withCount
    .filter((entry) => entry.count === minCount)
    .map((entry) => entry.mission);

  // 최저 횟수 그룹 안에서 서울 날짜 + 아이 해시로 결정적 로테이션.
  const index = hashToIndex(`${toSeoulDateKey(today)}:${childId}`, pool.length);
  return pool[index] ?? null;
}

export async function findCurrentMission(
  prisma: PrismaService,
  childId: string,
  ageMonths: number,
  today: Date,
): Promise<{
  mission: CurrentMissionRow;
  status: CurrentMissionStatus;
} | null> {
  const todayKey = toSeoulDateKey(today);
  const todayStart = new Date(`${todayKey}T00:00:00+09:00`);
  const todayEnd = new Date(`${todayKey}T23:59:59.999+09:00`);

  const existingExecution = await prisma.missionExecution.findFirst({
    where: {
      childId,
      startedAt: { gte: todayStart, lte: todayEnd },
      status: { not: 'cancelled' },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      status: true,
      mission: { select: CURRENT_MISSION_SELECT },
    },
  });

  if (existingExecution) {
    return {
      mission: existingExecution.mission,
      status: toCurrentMissionStatus(existingExecution.status),
    };
  }

  const mission = await findRecommendedMission(
    prisma,
    childId,
    ageMonths,
    today,
  );

  if (!mission) {
    return null;
  }

  return {
    mission,
    status: 'not_started',
  };
}

// 놀이 카탈로그가 커버하는 추천 월령 범위로 입력 월령을 클램프한다.
// 범위를 벗어나면 가장 가까운 경계(최저/최고 band)로 당겨, 더미가 아니라
// 가장 가까운 월령대의 실제 놀이를 추천하도록 한다. (open-ended band가 있으면
// 애초에 후보가 잡히므로 클램프는 양 끝이 모두 bounded일 때만 의미를 가진다.)
export async function clampAgeToMissionCatalog(
  prisma: PrismaService,
  ageMonths: number,
): Promise<number> {
  const bounds = await prisma.mission.aggregate({
    _min: { recommendedAgeMonthsMin: true },
    _max: { recommendedAgeMonthsMax: true },
  });
  const min = bounds._min.recommendedAgeMonthsMin;
  const max = bounds._max.recommendedAgeMonthsMax;

  let clamped = ageMonths;
  if (min != null && clamped < min) {
    clamped = min;
  }
  if (max != null && clamped > max) {
    clamped = max;
  }
  return clamped;
}

// 문자열 시드 → [0, length) 결정적 인덱스 (날짜·아이 기준 놀이 로테이션용).
function hashToIndex(seed: string, length: number): number {
  if (length <= 0) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % length) + length) % length;
}

export function toSeoulDateKey(date: Date): string {
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${seoul.getUTCFullYear()}-${String(seoul.getUTCMonth() + 1).padStart(2, '0')}-${String(seoul.getUTCDate()).padStart(2, '0')}`;
}
