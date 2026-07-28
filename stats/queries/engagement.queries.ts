import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ActiveDaysBucket,
  DailyPoint,
  HourPoint,
  WeekdayPoint,
} from '../stats.types';
import { activityEventsCte, TZ_SQL } from './activity-events.sql';

/**
 * 일별 시계열 — 활성 사용자 · 신규 가입 · 이벤트 종류별 건수.
 * generate_series로 빈 날짜도 0으로 채운다.
 */
export async function fetchDaily(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<DailyPoint[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      date: string;
      activeUsers: number;
      newUsers: number;
      mission: number;
      mood: number;
      care: number;
      chat: number;
    }>
  >(Prisma.sql`
    ${activityEventsCte(from, to)}
    , days AS (
      SELECT generate_series(
        (${from}::timestamptz AT TIME ZONE ${TZ_SQL})::date,
        (${to}::timestamptz AT TIME ZONE ${TZ_SQL})::date - 1,
        interval '1 day'
      )::date AS d
    )
    , signups AS (
      SELECT (u."createdAt" AT TIME ZONE ${TZ_SQL})::date AS d, count(*)::int AS n
        FROM "User" u
       WHERE u."createdAt" >= ${from}::timestamptz
         AND u."createdAt" < ${to}::timestamptz
       GROUP BY 1
    )
    SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
           count(DISTINCT e.user_id)::int AS "activeUsers",
           COALESCE(max(s.n), 0)::int AS "newUsers",
           count(*) FILTER (WHERE e.kind = 'mission')::int AS mission,
           count(*) FILTER (WHERE e.kind = 'mood')::int AS mood,
           count(*) FILTER (WHERE e.kind = 'care')::int AS care,
           count(*) FILTER (WHERE e.kind = 'chat')::int AS chat
      FROM days
      LEFT JOIN events e ON (e.at AT TIME ZONE ${TZ_SQL})::date = days.d
      LEFT JOIN signups s ON s.d = days.d
     GROUP BY days.d
     ORDER BY days.d
  `);
  return rows;
}

export type ActiveDaysSummary = {
  buckets: ActiveDaysBucket[];
  activeUsers: number;
  returningUsers: number;
  avgActiveDays: number;
};

/**
 * 재접속 지표 — 사용자별 "활동한 날의 수" 분포.
 * 2일 이상 활동 = 최소 한 번은 다시 돌아온 사용자로 본다.
 */
export async function fetchActiveDays(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<ActiveDaysSummary> {
  const rows = await prisma.$queryRaw<
    Array<{ bucket: ActiveDaysBucket['bucket']; users: number; days: number }>
  >(Prisma.sql`
    ${activityEventsCte(from, to)}
    , per_user AS (
      SELECT user_id,
             count(DISTINCT (at AT TIME ZONE ${TZ_SQL})::date)::int AS active_days
        FROM events
       GROUP BY user_id
    )
    SELECT CASE
             WHEN active_days = 1 THEN '1'
             WHEN active_days BETWEEN 2 AND 3 THEN '2-3'
             WHEN active_days BETWEEN 4 AND 7 THEN '4-7'
             WHEN active_days BETWEEN 8 AND 14 THEN '8-14'
             ELSE '15+'
           END AS bucket,
           count(*)::int AS users,
           sum(active_days)::int AS days
      FROM per_user
     GROUP BY 1
  `);

  const order: ActiveDaysBucket['bucket'][] = [
    '1',
    '2-3',
    '4-7',
    '8-14',
    '15+',
  ];
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const buckets = order.map((bucket) => ({
    bucket,
    users: byBucket.get(bucket)?.users ?? 0,
  }));

  const activeUsers = rows.reduce((acc, r) => acc + r.users, 0);
  const returningUsers = rows
    .filter((r) => r.bucket !== '1')
    .reduce((acc, r) => acc + r.users, 0);
  const totalDays = rows.reduce((acc, r) => acc + r.days, 0);

  return {
    buckets,
    activeUsers,
    returningUsers,
    avgActiveDays: activeUsers === 0 ? 0 : totalDays / activeUsers,
  };
}

/** 요일별 활동량 (1=월 … 7=일, ISO). */
export async function fetchWeekday(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<WeekdayPoint[]> {
  const rows = await prisma.$queryRaw<
    Array<{ weekday: number; events: number; activeUsers: number }>
  >(Prisma.sql`
    ${activityEventsCte(from, to)}
    SELECT extract(isodow FROM (at AT TIME ZONE ${TZ_SQL}))::int AS weekday,
           count(*)::int AS events,
           count(DISTINCT user_id)::int AS "activeUsers"
      FROM events
     GROUP BY 1
  `);
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  return Array.from({ length: 7 }, (_, i) => {
    const weekday = i + 1;
    const row = byDay.get(weekday);
    return {
      weekday,
      events: row?.events ?? 0,
      activeUsers: row?.activeUsers ?? 0,
    };
  });
}

/** 시간대별 활동량 (0~23시, KST). */
export async function fetchHourly(
  prisma: PrismaService,
  from: Date,
  to: Date,
): Promise<HourPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ hour: number; events: number }>>(
    Prisma.sql`
      ${activityEventsCte(from, to)}
      SELECT extract(hour FROM (at AT TIME ZONE ${TZ_SQL}))::int AS hour,
             count(*)::int AS events
        FROM events
       GROUP BY 1
    `,
  );
  const byHour = new Map(rows.map((r) => [r.hour, r.events]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    events: byHour.get(hour) ?? 0,
  }));
}
