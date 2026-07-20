import {
  Controller,
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  MarkAllNotificationsReadResponseDto,
  NotificationListItemDto,
  NotificationListResponseDto,
} from './dto/notification.dto';
import {
  DeletePushTokenResponseDto,
  UpsertPushTokenDto,
  UpsertPushTokenResponseDto,
} from './dto/push-token.dto';
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

  @Post('push-tokens')
  @SkipOnboardingCheck()
  @ApiOkResponse({ type: UpsertPushTokenResponseDto })
  upsertPushToken(
    @CurrentUserId() userId: string,
    @Body() body: UpsertPushTokenDto,
  ): Promise<UpsertPushTokenResponseDto> {
    return this.notificationsService.upsertPushToken(userId, body);
  }

  @Delete('push-tokens/:deviceId')
  @HttpCode(200)
  @SkipOnboardingCheck()
  @ApiParam({ name: 'deviceId', type: String })
  @ApiOkResponse({ type: DeletePushTokenResponseDto })
  deletePushToken(
    @CurrentUserId() userId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<DeletePushTokenResponseDto> {
    return this.notificationsService.deletePushToken(userId, deviceId);
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
