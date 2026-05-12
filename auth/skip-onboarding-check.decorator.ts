import { SetMetadata } from '@nestjs/common';

export const SKIP_ONBOARDING_CHECK_KEY = 'skipOnboardingCheck';

/**
 * 라우트 단위로 `OnboardingCompleteGuard` 검사 스킵.
 * `POST /onboarding/complete`, `GET /me` 등 온보딩 미완료자도 접근 가능한 엔드포인트에 사용.
 */
export const SkipOnboardingCheck = () =>
  SetMetadata(SKIP_ONBOARDING_CHECK_KEY, true);
