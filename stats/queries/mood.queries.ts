import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { MoodDailyPoint, MoodLevelPoint } from '../stats.types';
import { TZ_SQL } from './activity-events.sql';

/** 오늘의 기분(마음 배터리) 레벨 1~5 분포. 기록 없는 레벨도 0으로 채운다. */
export async function fetchMoodLevels(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<MoodLevelPoint[]> {
  const grouped = await prisma.mentalBatteryCheck.groupBy({
    by: ['level'],
    where: { checkedAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const byLevel = new Map(grouped.map((g) => [g.level, g._count._all]));
  return [1, 2, 3, 4, 5].map((level) => ({
    level,
    count: byLevel.get(level) ?? 0,
  }));
}

/** 일별 평균 기분 레벨 — 기록이 없는 날은 avgLevel null. */
export async function fetchMoodDaily(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<MoodDailyPoint[]> {
  return prisma.$queryRaw<MoodDailyPoint[]>(Prisma.sql`
    WITH days AS (
      SELECT generate_series(
        (${from}::timestamptz AT TIME ZONE ${TZ_SQL})::date,
        (${to}::timestamptz AT TIME ZONE ${TZ_SQL})::date - 1,
        interval '1 day'
      )::date AS d
    )
    SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
           avg(b."level")::float AS "avgLevel",
           count(b.id)::int AS count
      FROM days
      LEFT JOIN "MentalBatteryCheck" b
        ON (b."checkedAt" AT TIME ZONE ${TZ_SQL})::date = days.d
       AND b."checkedAt" >= ${from}::timestamptz
       AND b."checkedAt" < ${to}::timestamptz
     GROUP BY days.d
     ORDER BY days.d
  `);
}

/** 마음 케어 실행 건수 (마음 배터리 체크 이후 이어지는 행동). */
export function countCareExecutions(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<number> {
  return prisma.mentalCareExecution.count({
    where: { startedAt: { gte: from, lt: to } },
  });
}
