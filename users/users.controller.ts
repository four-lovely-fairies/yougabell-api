import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationPreferenceType } from '@prisma/client';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UpsertNotificationPreferenceDto } from './dto/upsert-notification-preference.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @SkipOnboardingCheck()
  @ApiOperation({
    summary: '본인 정보 조회',
    description:
      'User + children(deletedAt 필터) + notificationPreferences 포함. onboardedAt이 null이면 미완료.',
  })
  async getMe(@CurrentUserId() userId: string) {
    return this.onboarding.getMe(this.prisma, userId);
  }

  @Patch('parent')
  @ApiOperation({
    summary: '본인 정보 수정 (Figma 2395:9320)',
    description: '부분 갱신. name·birthDate·gender·workStatus 중 일부.',
  })
  async updateParent(
    @CurrentUserId() userId: string,
    @Body() body: UpdateParentDto,
  ) {
    return this.users.updateParent(userId, body);
  }

  @Patch('interests')
  @ApiOperation({
    summary: '관심 주제 수정 (Figma 2395:9162)',
    description: '최대 3개로 일괄 교체.',
  })
  async updateInterests(
    @CurrentUserId() userId: string,
    @Body() body: UpdateInterestsDto,
  ) {
    return this.users.updateInterests(userId, body);
  }

  @Patch('notifications/:type')
  @ApiParam({
    name: 'type',
    enum: ['play_10min', 'weekly_report'],
    description: '알림 종류.',
  })
  @ApiOperation({
    summary: '알림 종류별 enabled+time 설정 (Figma 2395:9126)',
    description:
      'play_10min(10분 놀이) 또는 weekly_report(주간 리포트) preference를 upsert.',
  })
  async upsertNotification(
    @CurrentUserId() userId: string,
    @Param('type') type: NotificationPreferenceType,
    @Body() body: UpsertNotificationPreferenceDto,
  ) {
    return this.users.upsertNotificationPreference(userId, type, body);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: '계정 탈퇴 (Figma 2395:8988)',
    description:
      'soft delete (deletedAt set). 30일 후 cron으로 hard delete + cascade.',
  })
  async deleteAccount(
    @CurrentUserId() userId: string,
    @Body() body: DeleteAccountDto,
  ): Promise<void> {
    return this.users.softDeleteAccount(userId, body);
  }

  @Post('reset-onboarding')
  @HttpCode(204)
  @SkipOnboardingCheck()
  @ApiNoContentResponse()
  @ApiOperation({
    summary: '[임시] 온보딩 재진입을 위한 회원 정보 초기화',
    description:
      '개발/테스트 전용. User row를 삭제해 Child·NotificationPreference 등 cascade 정리. ' +
      'Supabase 세션은 그대로이므로 클라이언트에서 signOut + /onboarding/intro 이동 필요.',
  })
  async resetOnboarding(@CurrentUserId() userId: string): Promise<void> {
    return this.users.resetOnboarding(userId);
  }
}
