import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminInquiriesController } from './admin-inquiries.controller';
import { AdminInquiriesService } from './admin-inquiries.service';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService, AdminInquiriesService],
})
export class InquiriesModule {}
