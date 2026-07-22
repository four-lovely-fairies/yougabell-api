import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { SendTestPushDto } from './dto/send-test-push.dto';
import { PushNotificationService } from './push-notification.service';

const DEFAULT_TEST_PUSH_TITLE = '육아벨 테스트 알림';
const DEFAULT_TEST_PUSH_BODY =
  '푸시 알림이 정상 동작하는지 확인하는 테스트입니다.';

/**
 * 운영자(admin) 전용 푸시 도구. 내부 cron 엔드포인트(send-test)와 동일한 발송을
 * 하지만 cron secret이 아니라 admin JWT로 인가한다 — admin(웹) UI에서 직접 호출용.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@SkipOnboardingCheck()
export class NotificationsAdminController {
  constructor(private readonly pushNotifications: PushNotificationService) {}

  @Post('test-push')
  @ApiOperation({
    summary: '테스트 푸시 발송 (운영자)',
    description:
      'preference·시간창을 무시하고 대상 사용자에게 푸시를 강제 발송하고 토큰별 결과를 반환한다. ' +
      'attempted:0=토큰 미등록, sent:0=죽은 토큰, sent>0=정상.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        attempted: 1,
        sent: 1,
        failed: 0,
        tickets: [{ token: 'ExponentPushToken[xxx]', status: 'ok' }],
      },
    },
  })
  testPush(@Body() body: SendTestPushDto) {
    return this.pushNotifications.sendToUserDetailed({
      userId: body.userId,
      title: body.title ?? DEFAULT_TEST_PUSH_TITLE,
      body: body.body ?? DEFAULT_TEST_PUSH_BODY,
      data: { actionType: 'open_home' },
    });
  }
}
