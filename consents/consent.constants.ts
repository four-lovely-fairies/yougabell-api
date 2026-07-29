import type { ConsentType } from '@prisma/client';

/**
 * 약관 동의 공통 상수 (docs/features/20260729-consent-storage.md).
 *
 * 버전 문자열은 **약관 개정일**을 쓴다. 개정 시 이 값만 올리고, 이전 버전 동의자에게
 * 재동의를 요청한다. 여기가 단일 소스 — 다른 곳에 하드코딩하지 않는다.
 */
export const CURRENT_TERMS_VERSION = '2026-05-15';

/** 서비스 이용에 반드시 필요한 동의. 철회 대상이 아니다(철회 = 이용 불가). */
export const REQUIRED_CONSENT_TYPES = ['service', 'privacy'] as const;

/** 사용자가 켜고 끌 수 있는 선택 동의. */
export const OPTIONAL_CONSENT_TYPES = ['marketing'] as const;

export const CONSENT_TYPES = [
  ...REQUIRED_CONSENT_TYPES,
  ...OPTIONAL_CONSENT_TYPES,
] satisfies ConsentType[];

export type RequiredConsentType = (typeof REQUIRED_CONSENT_TYPES)[number];
export type OptionalConsentType = (typeof OPTIONAL_CONSENT_TYPES)[number];

export function isOptionalConsentType(
  type: string,
): type is OptionalConsentType {
  return (OPTIONAL_CONSENT_TYPES as readonly string[]).includes(type);
}
