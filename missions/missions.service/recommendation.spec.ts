import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampAgeToMissionCatalog } from './recommendation';

// aggregate만 사용하는 최소 Prisma stub.
function stubPrisma(min: number | null, max: number | null) {
  return {
    mission: {
      aggregate: () =>
        Promise.resolve({
          _min: { recommendedAgeMonthsMin: min },
          _max: { recommendedAgeMonthsMax: max },
        }),
    },
  } as never;
}

void describe('clampAgeToMissionCatalog', () => {
  void it('상한을 넘는 월령은 카탈로그 최고 band로 당긴다', async () => {
    // 카탈로그 [0, 60]인데 아이가 180개월 → 60으로 클램프
    const result = await clampAgeToMissionCatalog(stubPrisma(0, 60), 180);
    assert.equal(result, 60);
  });

  void it('하한 미만 월령은 카탈로그 최저 band로 당긴다', async () => {
    // 카탈로그 [6, 60]인데 아이가 2개월 → 6으로 클램프
    const result = await clampAgeToMissionCatalog(stubPrisma(6, 60), 2);
    assert.equal(result, 6);
  });

  void it('범위 안의 월령은 그대로 둔다', async () => {
    const result = await clampAgeToMissionCatalog(stubPrisma(0, 60), 24);
    assert.equal(result, 24);
  });

  void it('경계 정보가 없으면(null) 클램프하지 않는다', async () => {
    const result = await clampAgeToMissionCatalog(stubPrisma(null, null), 180);
    assert.equal(result, 180);
  });
});
