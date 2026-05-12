import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
@SkipOnboardingCheck()
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post('complete')
  @ApiOperation({
    summary: '온보딩 일괄 완료',
    description:
      'Parent 정보 + Child[] + 앱 사용 시간대[]를 단일 atomic 트랜잭션으로 적용. ' +
      '이미 완료된 사용자는 409.',
  })
  async complete(
    @CurrentUserId() userId: string,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.service.complete(userId, dto);
  }
}
