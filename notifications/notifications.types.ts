import {
  NotificationActionType,
  NotificationTargetType,
  NotificationType,
  NotificationPriority,
} from '@prisma/client';

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actionType: NotificationActionType;
  targetType: NotificationTargetType | null;
  targetId: string | null;
  targetUrl: string | null;
  priority: NotificationPriority;
  createdAt: string;
  readAt: string | null;
};

export type NotificationListResponse = {
  items: NotificationListItem[];
};
