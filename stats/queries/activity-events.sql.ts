import { Prisma } from '@prisma/client';

/** 집계 기준 타임존 — 서비스 사용자는 전원 국내이므로 KST 고정. */
export const TZ = 'Asia/Seoul';

/**
 * `AT TIME ZONE` 뒤에 그대로 끼워 넣는 리터럴.
 * 바인딩 파라미터로 넘기면 Postgres가 타입을 추론하지 못하는 경우가 있어 상수 리터럴로 둔다.
 * 값은 코드 상수라 인젝션 여지가 없다.
 */
export const TZ_SQL = Prisma.raw(`'${TZ}'`);

/**
 * 활동 이벤트 CTE.
 *
 * 접속 로그 테이블이 없으므로 사용자가 실제로 앱을 열어야 남는 4종 기록을
 * "접속"의 프록시로 합친다.
 * - mission: 오늘의 놀이 실행 (`MissionExecution`)
 * - mood: 오늘의 기분 = 마음 배터리 체크 (`MentalBatteryCheck`)
 * - care: 마음 케어 실행 (`MentalCareExecution`)
 * - chat: 챗 사용자 발화 (`ChatMessage.role = user`)
 *
 * 사용하는 쿼리는 이 조각을 맨 앞에 붙이고 `events` 를 참조한다.
 */
export function activityEventsCte(from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    WITH events AS (
      SELECT e."userId" AS user_id,
             e."startedAt" AS at,
             'mission'::text AS kind
        FROM "MissionExecution" e
       WHERE e."startedAt" >= ${from}::timestamptz
         AND e."startedAt" < ${to}::timestamptz
      UNION ALL
      SELECT b."userId", b."checkedAt", 'mood'::text
        FROM "MentalBatteryCheck" b
       WHERE b."checkedAt" >= ${from}::timestamptz
         AND b."checkedAt" < ${to}::timestamptz
      UNION ALL
      SELECT c."userId", c."startedAt", 'care'::text
        FROM "MentalCareExecution" c
       WHERE c."startedAt" >= ${from}::timestamptz
         AND c."startedAt" < ${to}::timestamptz
      UNION ALL
      SELECT s."userId", m."sentAt", 'chat'::text
        FROM "ChatMessage" m
        JOIN "ChatSession" s ON s."id" = m."sessionId"
       WHERE m."role"::text = 'user'
         AND m."sentAt" >= ${from}::timestamptz
         AND m."sentAt" < ${to}::timestamptz
    )
  `;
}
