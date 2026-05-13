import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  /**
   * 본인 정보 조회. `onboardedAt`이 null이면 클라이언트는 `/onboarding`으로 리디렉트.
   * 온보딩 게이트는 우회 (`SkipOnboardingCheck`).
   */
  @Get()
  @SkipOnboardingCheck()
  @ApiOperation({
    summary: '본인 정보 조회',
    description:
      'User 본인 + children + 알림 시간대(notificationSlot/notificationTime) 포함. onboardedAt이 null이면 미완료.',
  })
  async getMe(@CurrentUserId() userId: string) {
    return this.onboarding.getMe(this.prisma, userId);
  }
}
