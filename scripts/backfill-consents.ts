/**
 * 기존 사용자 필수 동의 소급 생성 (일회성).
 *
 * 배경: 온보딩 동의 바텀시트는 2026-05-15부터 필수 2건을 강제해 왔지만, 체크 결과가
 * 서버로 전송되지 않아 DB에 기록이 없다. 온보딩 완료자는 플로우상 필수 2건에 동의한
 * 것이 확정이므로 `onboardedAt` 시각 기준으로 소급 생성한다.
 *
 * 소급분은 실제 캡처가 아니라 **역산**이므로 `source: backfill`로 구분해 남긴다.
 * 마케팅은 값이 온 적이 없어 동의/거부를 알 수 없다 → **row를 만들지 않는다**
 * (`agreed: false`는 "거부 의사 표시"라는 다른 의미가 된다).
 *
 * 멱등: 같은 (userId, type, source=backfill) row가 있으면 건너뛴다.
 *
 * 실행 (워크스페이스 루트에서):
 *   `cd yougabell-api && pnpm exec ts-node scripts/backfill-consents.ts [--apply]`
 *   --apply 없이 실행하면 dry-run (변경 없이 대상 집계만 출력).
 *
 * 기획: yougabell/docs/features/20260729-consent-storage.md §5
 */
import 'dotenv/config';
import {
  CURRENT_TERMS_VERSION,
  REQUIRED_CONSENT_TYPES,
} from '../consents/consent.constants';
import { PrismaService } from '../prisma/prisma.service';

const NOTE = '온보딩 필수동의 강제 플로우 기반 소급 생성 (2026-07-29)';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaService();

  const users = await prisma.user.findMany({
    where: { onboardedAt: { not: null }, deletedAt: null },
    select: { id: true, name: true, onboardedAt: true },
    orderBy: { onboardedAt: 'asc' },
  });

  const existing = await prisma.userConsent.findMany({
    where: { source: 'backfill', type: { in: [...REQUIRED_CONSENT_TYPES] } },
    select: { userId: true, type: true },
  });
  const done = new Set(existing.map((r) => `${r.userId}:${r.type}`));

  const rows = users.flatMap((u) =>
    REQUIRED_CONSENT_TYPES.filter((type) => !done.has(`${u.id}:${type}`)).map(
      (type) => ({
        userId: u.id,
        type,
        agreed: true,
        version: CURRENT_TERMS_VERSION,
        source: 'backfill' as const,
        note: NOTE,
        // 동의는 온보딩 안에서 일어났다 — createdAt(계정 생성)이 아니라 onboardedAt.
        agreedAt: u.onboardedAt!,
      }),
    ),
  );

  console.log(`온보딩 완료·미탈퇴 사용자: ${users.length}명`);
  console.log(`이미 소급된 row: ${existing.length}건`);
  console.log(`생성 대상: ${rows.length}건 (사용자당 최대 2건)`);

  if (rows.length === 0) {
    console.log('생성할 row 없음 — 종료');
  } else if (!apply) {
    console.log('\n[dry-run] --apply 를 붙여야 실제로 INSERT 합니다.');
    console.log('샘플 3건:', JSON.stringify(rows.slice(0, 3), null, 2));
  } else {
    const result = await prisma.userConsent.createMany({ data: rows });
    console.log(`\n생성 완료: ${result.count}건`);
  }

  const total = await prisma.userConsent.groupBy({
    by: ['type', 'source'],
    _count: { _all: true },
  });
  console.log('\n현재 UserConsent 집계:');
  for (const t of total) {
    console.log(`  ${t.type} / ${t.source}: ${t._count._all}건`);
  }

  await prisma.$disconnect();
}

void main();
