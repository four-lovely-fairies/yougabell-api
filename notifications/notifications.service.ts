import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPushTokenDto } from './dto/push-token.dto';
import {
  NotificationListItem,
  NotificationListResponse,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limit = 20): Promise<NotificationListResponse> {
    const take = normalizeLimit(limit);
    const notifications = await this.prisma.notification.findMany({
      where: activeNotificationWhere(userId),
      orderBy: { createdAt: 'desc' },
      take,
    });

    return {
      items: notifications.map(toListItem),
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationListItem> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found.',
      });
    }

    if (notification.readAt) {
      return toListItem(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
    return toListItem(updated);
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        ...activeNotificationWhere(userId),
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  async upsertPushToken(
    userId: string,
    dto: UpsertPushTokenDto,
  ): Promise<{ ok: true }> {
    await this.prisma.userPushToken.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId: dto.deviceId,
        },
      },
      create: {
        userId,
        deviceId: dto.deviceId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        token: dto.token,
        platform: dto.platform,
      },
    });

    return { ok: true };
  }

  async deletePushToken(
    userId: string,
    deviceId: string,
  ): Promise<{ deletedCount: number }> {
    const result = await this.prisma.userPushToken.deleteMany({
      where: { userId, deviceId },
    });

    return { deletedCount: result.count };
  }
}

function normalizeLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'limit must be a positive integer.',
    });
  }
  return Math.min(limit, 50);
}

function activeNotificationWhere(
  userId: string,
): Prisma.NotificationWhereInput {
  return {
    userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

function toListItem(notification: {
  id: string;
  type: NotificationListItem['type'];
  title: string;
  body: string;
  actionType: NotificationListItem['actionType'];
  targetType: NotificationListItem['targetType'];
  targetId: string | null;
  targetUrl: string | null;
  priority: NotificationListItem['priority'];
  createdAt: Date;
  readAt: Date | null;
}): NotificationListItem {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    actionType: notification.actionType,
    targetType: notification.targetType,
    targetId: notification.targetId,
    targetUrl: notification.targetUrl,
    priority: notification.priority,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}
