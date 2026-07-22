import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsAdminController } from './notifications.admin.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsInternalController } from './notifications.internal.controller';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [AuthModule],
  controllers: [
    NotificationsController,
    NotificationsInternalController,
    NotificationsAdminController,
  ],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    PushNotificationService,
  ],
})
export class NotificationsModule {}
