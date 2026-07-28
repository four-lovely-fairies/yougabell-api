import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CategoryPoint,
  FeedbackSummary,
  KeywordPoint,
  MissionStatusPoint,
  TopMissionPoint,
} from '../stats.types';

/** 오늘의 놀이 실행 상태 분포. */
export async function fetchMissionStatus(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<MissionStatusPoint[]> {
  const grouped = await prisma.missionExecution.groupBy({
    by: ['status'],
    where: { startedAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  // 화면 legend 순서를 고정하기 위해 enum 정의 순서를 그대로 따른다.
  const order = [
    'completed',
    'early_completed',
    'in_progress',
    'paused',
    'cancelled',
  ] as const;
  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  return order.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));
}

/** 실행 수 상위 놀이 TOP N — 완료 건수·평균 만족도 동반. */
export function fetchTopMissions(
  prisma: PrismaService,
  from: Date,
  to: Date,
  limit = 10,
): Promise<TopMissionPoint[]> {
  return prisma.$queryRaw<TopMissionPoint[]>(Prisma.sql`
    SELECT m.id AS "missionId",
           m.title AS title,
           m."categoryId" AS "categoryId",
           count(e.id)::int AS executions,
           count(e.id) FILTER (
             WHERE e.status::text IN ('completed', 'early_completed')
           )::int AS completed,
           avg(f."missionSatisfaction")::float AS "avgSatisfaction"
      FROM "MissionExecution" e
      JOIN "Mission" m ON m.id = e."missionId"
      LEFT JOIN "MissionFeedback" f ON f."executionId" = e.id
     WHERE e."startedAt" >= ${from}::timestamptz
       AND e."startedAt" < ${to}::timestamptz
     GROUP BY m.id, m.title, m."categoryId"
     ORDER BY executions DESC, m.title ASC
     LIMIT ${limit}
  `);
}

/** 발달 카테고리별 놀이 실행 분포. */
export function fetchCategoryDistribution(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<CategoryPoint[]> {
  return prisma.$queryRaw<CategoryPoint[]>(Prisma.sql`
    SELECT c.id AS "categoryId",
           c.label AS label,
           count(e.id)::int AS executions
      FROM "MilestoneCategory" c
      JOIN "Mission" m ON m."categoryId" = c.id
      JOIN "MissionExecution" e
        ON e."missionId" = m.id
       AND e."startedAt" >= ${from}::timestamptz
       AND e."startedAt" < ${to}::timestamptz
     GROUP BY c.id, c.label, c."displayOrder"
     ORDER BY c."displayOrder" ASC
  `);
}

/** 놀이 피드백 평균 — 아이 반응 / 부모 에너지 / 만족도. */
export async function fetchFeedbackSummary(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<FeedbackSummary> {
  const agg = await prisma.missionFeedback.aggregate({
    where: { execution: { startedAt: { gte: from, lt: to } } },
    _count: { _all: true },
    _avg: {
      childReaction: true,
      parentEnergy: true,
      missionSatisfaction: true,
    },
  });
  return {
    count: agg._count._all,
    avgChildReaction: agg._avg.childReaction,
    avgParentEnergy: agg._avg.parentEnergy,
    avgMissionSatisfaction: agg._avg.missionSatisfaction,
  };
}

/** 피드백 키워드 TOP N. */
export function fetchTopKeywords(
  prisma: PrismaService,
  from: Date,
  to: Date,
  limit = 12,
): Promise<KeywordPoint[]> {
  return prisma.$queryRaw<KeywordPoint[]>(Prisma.sql`
    SELECT k.keyword AS keyword,
           count(*)::int AS count
      FROM "MissionFeedbackKeyword" k
      JOIN "MissionFeedback" f ON f.id = k."feedbackId"
      JOIN "MissionExecution" e ON e.id = f."executionId"
     WHERE e."startedAt" >= ${from}::timestamptz
       AND e."startedAt" < ${to}::timestamptz
     GROUP BY k.keyword
     ORDER BY count DESC, k.keyword ASC
     LIMIT ${limit}
  `);
}
