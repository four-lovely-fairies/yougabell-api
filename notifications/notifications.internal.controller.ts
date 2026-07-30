import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { DispatchNotificationsDto } from './dto/dispatch-notifications.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PushNotificationService } from './push-notification.service';

const DEFAULT_TEST_PUSH_TITLE = '육아벨 테스트 알림';
const DEFAULT_TEST_PUSH_BODY =
  '푸시 알림이 정상 동작하는지 확인하는 테스트입니다.';

@ApiExcludeController()
@Controller('internal/notifications')
@SkipOnboardingCheck()
export class NotificationsInternalController {
  constructor(
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly pushNotifications: PushNotificationService,
  ) {}

  @Post('dispatch-play-reminders')
  dispatchPlayReminders(
    @Headers('x-cron-secret') cronSecret: string | undefined,
    @Body() body: DispatchNotificationsDto,
  ) {
    assertCronSecret(cronSecret);
    return this.notificationDispatch.dispatchPlayReminders(body);
  }

  @Post('dispatch-weekly-report-notifications')
  dispatchWeeklyReportNotifications(
    @Headers('x-cron-secret') cronSecret: string | undefined,
    @Body() body: DispatchNotificationsDto,
  ) {
    assertCronSecret(cronSecret);
    return this.notificationDispatch.dispatchWeeklyReportNotifications(body);
  }

  // 특정 사용자에게 preference·시간창을 무시하고 푸시를 강제 발송한다.
  // 반환값으로 토큰 상태를 진단:
  //   attempted:0 → 토큰 미등록 / sent:0 → 죽은 토큰 / sent>0 → 정상.
  // Notification(벨) row는 만들지 않는다 — 순수 토큰 검증용.
  @Post('send-test')
  sendTest(
    @Headers('x-cron-secret') cronSecret: string | undefined,
    @Body() body: SendTestPushDto,
  ) {
    assertCronSecret(cronSecret);
    return this.pushNotifications.sendToUserDetailed({
      userId: body.userId,
      title: body.title ?? DEFAULT_TEST_PUSH_TITLE,
      body: body.body ?? DEFAULT_TEST_PUSH_BODY,
      data: { actionType: 'open_home' },
    });
  }
}

function assertCronSecret(cronSecret: string | undefined) {
  const expectedSecret = process.env.NOTIFICATION_CRON_SECRET;
  if (!expectedSecret || cronSecret !== expectedSecret) {
    throw new UnauthorizedException({
      code: 'INVALID_CRON_SECRET',
      message: 'Invalid cron secret.',
    });
  }
}
