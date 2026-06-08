import { MissionExecutionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toCurrentMissionStatus } from './execution.utils';
import {
  CURRENT_MISSION_SELECT,
  CurrentMissionRow,
  CurrentMissionStatus,
} from './selects';

// 오늘의 추천 미션 선정.
// 1) 아이 월령·카테고리·추천연령에 맞는 후보 미션 전체를 모은다.
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
  const milestones = await prisma.milestone.findMany({
    where: {
      ageMonthsFrom: { lte: ageMonths },
      ageMonthsTo: { gte: ageMonths },
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
        { recommendedAgeMonthsMin: { lte: ageMonths } },
      ],
      AND: [
        {
          OR: [
            { recommendedAgeMonthsMax: null },
            { recommendedAgeMonthsMax: { gte: ageMonths } },
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

  // 아이별 미션 수행(완료) 횟수 집계.
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

// 문자열 시드 → [0, length) 결정적 인덱스 (날짜·아이 기준 미션 로테이션용).
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

function toSeoulDateKey(date: Date): string {
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${seoul.getUTCFullYear()}-${String(seoul.getUTCMonth() + 1).padStart(2, '0')}-${String(seoul.getUTCDate()).padStart(2, '0')}`;
}
