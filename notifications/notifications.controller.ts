import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import type {
  NotificationListItem,
  NotificationListResponse,
} from './notifications.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.list(userId, limit ? Number(limit) : 20);
  }

  @Patch('read-all')
  markAllRead(@CurrentUserId() userId: string): Promise<{
    updatedCount: number;
  }> {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<NotificationListItem> {
    return this.notificationsService.markRead(userId, id);
  }
}
