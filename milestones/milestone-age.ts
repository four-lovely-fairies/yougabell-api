import type { Prisma } from '@prisma/client';

/**
 * 마일스톤 월령 구간은 **반열린 `(from, to]`** 다.
 *
 * 시드 임포트(`scripts/import-csv-data.ts`)가 CDC 단일 시점 데이터를 구간으로 펼치면서
 * `ageMonthsFrom = 직전 시점`, `ageMonthsTo = 해당 시점`으로 저장한다.
 * 예) 2개월 항목 → 0~2, 4개월 항목 → 2~4, 6개월 항목 → 4~6.
 *
 * 즉 **해당 마일스톤이 속한 시점은 `ageMonthsTo`** 이고, `ageMonthsFrom`은 직전 시점이라
 * 그 시점의 마일스톤이 따로 존재한다. 그래서 양끝 포함(`from <= X <= to`)으로 조회하면
 * 경계 월령에서 **직전 시점 항목까지 같이 잡혀 화면에 두 배로 노출**된다.
 * (2026-07-29 로드맵 중복 노출 버그 — 159건 중 148건이 두 탭에 동시 노출됐다.)
 *
 * 0개월만 예외로 양끝 포함을 쓴다. 첫 구간이 `0~2`라 strict 비교로는 아무것도 안 잡힌다.
 */
export function milestoneAgeWhere(
  ageMonths: number,
): Prisma.MilestoneWhereInput {
  if (ageMonths <= 0) {
    return { ageMonthsFrom: { lte: 0 }, ageMonthsTo: { gte: 0 } };
  }
  return {
    ageMonthsFrom: { lt: ageMonths },
    ageMonthsTo: { gte: ageMonths },
  };
}
