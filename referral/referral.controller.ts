import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  CheckInviteCodeRequestDto,
  ClaimReferralRewardRequestDto,
  InviteCodeCheckResponseDto,
  MyReferralResponseDto,
  ReferralRewardClaimDto,
} from './referral.dto';
import { ReferralService } from './referral.service';

@ApiTags('referral')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ReferralController {
  constructor(private readonly service: ReferralService) {}

  /** 온보딩 초대 코드 화면 — 가입 전이라 온보딩 검사를 건너뛴다. */
  @Post('referral/check-code')
  @HttpCode(200)
  @SkipOnboardingCheck()
  @ApiOkResponse({ type: InviteCodeCheckResponseDto })
  checkCode(
    @CurrentUserId() userId: string,
    @Body() body: CheckInviteCodeRequestDto,
  ) {
    return this.service.checkCode(userId, body.code);
  }

  @Get('me/referral')
  @ApiOkResponse({ type: MyReferralResponseDto })
  getMine(@CurrentUserId() userId: string) {
    return this.service.getMyReferral(userId);
  }

  @Post('me/referral/reward-claim')
  @ApiCreatedResponse({ type: ReferralRewardClaimDto })
  claim(
    @CurrentUserId() userId: string,
    @Body() body: ClaimReferralRewardRequestDto,
  ) {
    return this.service.claimReward(userId, body.phone);
  }
}
