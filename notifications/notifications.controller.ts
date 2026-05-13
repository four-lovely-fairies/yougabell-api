import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  MarkAllNotificationsReadResponseDto,
  NotificationListItemDto,
  NotificationListResponseDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: NotificationListResponseDto })
  list(
    @CurrentUserId() userId: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.list(userId, limit ? Number(limit) : 20);
  }

  @Patch('read-all')
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  markAllRead(
    @CurrentUserId() userId: string,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: NotificationListItemDto })
  markRead(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<NotificationListItemDto> {
    return this.notificationsService.markRead(userId, id);
  }
}
