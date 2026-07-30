import type { ConsentSource, ConsentType, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CONSENT_TYPES, CURRENT_TERMS_VERSION } from './consent.constants';

/** 트랜잭션 클라이언트와 일반 클라이언트 양쪽에서 호출 가능하도록. */
export type PrismaLike =
  | PrismaService
  | Omit<Prisma.TransactionClient, '$connect' | '$disconnect'>;

export type ConsentState = {
  agreed: boolean;
  version: string;
  source: ConsentSource;
  agreedAt: string;
};

/** type별 현재 동의 상태. row가 없으면 null — "거부"가 아니라 "모름"이다. */
export type ConsentsResponse = Record<ConsentType, ConsentState | null>;

/**
 * 동의 이력을 추가한다. **항상 INSERT** — append-only라 기존 row를 건드리지 않는다.
 */
export function recordConsent(
  client: PrismaLike,
  input: {
    userId: string;
    type: ConsentType;
    agreed: boolean;
    source?: ConsentSource;
    version?: string;
    note?: string;
    agreedAt?: Date;
  },
) {
  return client.userConsent.create({
    data: {
      userId: input.userId,
      type: input.type,
      agreed: input.agreed,
      version: input.version ?? CURRENT_TERMS_VERSION,
      source: input.source ?? 'user_action',
      note: input.note ?? null,
      ...(input.agreedAt ? { agreedAt: input.agreedAt } : {}),
    },
  });
}

/**
 * type별 최신 1건을 뽑아 현재 동의 상태로 정리한다.
 *
 * 동의 종류가 3개뿐이라 전체를 가져와 메모리에서 접는다 — type별 DISTINCT ON 쿼리보다
 * 단순하고, 한 사용자의 이력이 수십 건을 넘길 일이 없다.
 */
export async function getConsents(
  client: PrismaLike,
  userId: string,
): Promise<ConsentsResponse> {
  const rows = await client.userConsent.findMany({
    where: { userId },
    orderBy: { agreedAt: 'desc' },
  });

  const result = Object.fromEntries(
    CONSENT_TYPES.map((type) => [type, null]),
  ) as ConsentsResponse;

  for (const row of rows) {
    // orderBy desc라 각 type의 첫 등장이 최신이다.
    if (result[row.type]) continue;
    result[row.type] = {
      agreed: row.agreed,
      version: row.version,
      source: row.source,
      agreedAt: row.agreedAt.toISOString(),
    };
  }

  return result;
}
