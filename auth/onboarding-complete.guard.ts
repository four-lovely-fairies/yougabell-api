import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { SKIP_ONBOARDING_CHECK_KEY } from './skip-onboarding-check.decorator';

/**
 * 온보딩 미완료 사용자는 보호 라우트 접근 차단.
 * `@SkipOnboardingCheck()` 데코레이터가 있는 핸들러는 통과.
 *
 * 비통과 시 403 + `{ code: 'ONBOARDING_REQUIRED', redirectTo: '/onboarding' }`
 *
 * 사용:
 *   @UseGuards(JwtAuthGuard, OnboardingCompleteGuard)
 */
@Injectable()
export class OnboardingCompleteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_ONBOARDING_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      this.jwtAuthGuard.canActivate(context);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { onboardedAt: true },
    });

    if (!user?.onboardedAt) {
      throw new ForbiddenException({
        code: 'ONBOARDING_REQUIRED',
        redirectTo: '/onboarding',
      });
    }
    return true;
  }
}
