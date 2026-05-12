import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OnboardingCompleteGuard } from './onboarding-complete.guard';

@Global()
@Module({
  providers: [JwtAuthGuard, OnboardingCompleteGuard],
  exports: [JwtAuthGuard, OnboardingCompleteGuard],
})
export class AuthModule {}
