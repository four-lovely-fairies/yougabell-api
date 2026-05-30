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
import { NotificationDispatchService } from './notification-dispatch.service';

@ApiExcludeController()
@Controller('internal/notifications')
@SkipOnboardingCheck()
export class NotificationsInternalController {
  constructor(
    private readonly notificationDispatch: NotificationDispatchService,
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
