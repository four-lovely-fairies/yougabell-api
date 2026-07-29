import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { milestoneAgeWhere } from './milestone-age';

/** 시드가 만드는 실제 구간 모양 — (직전 시점, 해당 시점]. */
const SEEDED_RANGES = [
  { from: 0, to: 2 },
  { from: 2, to: 4 },
  { from: 4, to: 6 },
  { from: 6, to: 9 },
  { from: 9, to: 12 },
  { from: 12, to: 15 },
  { from: 15, to: 18 },
  { from: 18, to: 24 },
  { from: 24, to: 30 },
  { from: 30, to: 36 },
  { from: 36, to: 48 },
  { from: 48, to: 60 },
];

const CHECKPOINTS = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];

/** where 절을 시드 구간에 직접 적용해 본다 (Prisma 없이 규칙만 검증). */
function matches(
  where: ReturnType<typeof milestoneAgeWhere>,
  range: { from: number; to: number },
): boolean {
  const fromCond = where.ageMonthsFrom as { lt?: number; lte?: number };
  const toCond = where.ageMonthsTo as { gte: number };
  const fromOk =
    fromCond.lt !== undefined
      ? range.from < fromCond.lt
      : range.from <= fromCond.lte!;
  return fromOk && range.to >= toCond.gte;
}

void describe('milestoneAgeWhere', () => {
  void it('matches exactly one seeded range per CDC checkpoint', () => {
    for (const checkpoint of CHECKPOINTS) {
      const hit = SEEDED_RANGES.filter((r) =>
        matches(milestoneAgeWhere(checkpoint), r),
      );
      assert.equal(
        hit.length,
        1,
        `${checkpoint}개월에 ${hit.length}개 구간이 걸림: ${JSON.stringify(hit)}`,
      );
      // 해당 시점의 구간은 to === checkpoint 인 것이어야 한다.
      assert.equal(hit[0].to, checkpoint);
    }
  });

  void it('does not leak the previous checkpoint into the current tab', () => {
    // 회귀 방지 — 양끝 포함으로 되돌리면 4개월 탭에 2~4와 4~6이 함께 잡힌다.
    const hit = SEEDED_RANGES.filter((r) => matches(milestoneAgeWhere(4), r));
    assert.deepEqual(hit, [{ from: 2, to: 4 }]);
  });

  void it('falls back to closed interval at 0 months', () => {
    // 첫 구간이 0~2라 strict 비교로는 아무것도 안 잡힌다 — 신생아가 빈 화면을 보면 안 된다.
    const hit = SEEDED_RANGES.filter((r) => matches(milestoneAgeWhere(0), r));
    assert.deepEqual(hit, [{ from: 0, to: 2 }]);
  });

  void it('matches the containing range for a month between checkpoints', () => {
    // 13개월(체크포인트 아님) → 12~15 하나만.
    const hit = SEEDED_RANGES.filter((r) => matches(milestoneAgeWhere(13), r));
    assert.deepEqual(hit, [{ from: 12, to: 15 }]);
  });
});
