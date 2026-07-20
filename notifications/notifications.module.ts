import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsInternalController } from './notifications.internal.controller';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController, NotificationsInternalController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    PushNotificationService,
  ],
})
export class NotificationsModule {}
