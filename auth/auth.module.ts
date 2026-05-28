import { Global, Module } from '@nestjs/common';
import { AdminRoleGuard } from './admin-role.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OnboardingCompleteGuard } from './onboarding-complete.guard';

@Global()
@Module({
  providers: [JwtAuthGuard, AdminRoleGuard, OnboardingCompleteGuard],
  exports: [JwtAuthGuard, AdminRoleGuard, OnboardingCompleteGuard],
})
export class AuthModule {}
