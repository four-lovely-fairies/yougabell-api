import { ApiProperty } from '@nestjs/swagger';
import type {
  NotificationActionType,
  NotificationPriority,
  NotificationTargetType,
  NotificationType,
} from '@prisma/client';

const NOTIFICATION_TYPES = [
  'mission_reminder',
  'mission_feedback',
  'weekly_report_ready',
  'roadmap_update',
  'mental_check_reminder',
  'chat_follow_up',
  'system_notice',
  'inquiry_answered',
] as const satisfies NotificationType[];
const NOTIFICATION_ACTION_TYPES = [
  'none',
  'open_home',
  'open_mission',
  'open_roadmap',
  'open_chat',
  'open_report',
  'url',
] as const satisfies NotificationActionType[];
const NOTIFICATION_TARGET_TYPES = [
  'mission',
  'mission_execution',
  'weekly_report',
  'child',
  'chat_session',
  'url',
  'inquiry',
] as const satisfies NotificationTargetType[];
const NOTIFICATION_PRIORITIES = [
  'normal',
  'high',
] as const satisfies NotificationPriority[];

export class NotificationListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  type!: (typeof NOTIFICATION_TYPES)[number];

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ enum: NOTIFICATION_ACTION_TYPES })
  actionType!: (typeof NOTIFICATION_ACTION_TYPES)[number];

  @ApiProperty({ enum: NOTIFICATION_TARGET_TYPES, nullable: true })
  targetType!: (typeof NOTIFICATION_TARGET_TYPES)[number] | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  targetId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  targetUrl!: string | null;

  @ApiProperty({ enum: NOTIFICATION_PRIORITIES })
  priority!: (typeof NOTIFICATION_PRIORITIES)[number];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationListItemDto] })
  items!: NotificationListItemDto[];
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({ example: 3, minimum: 0 })
  updatedCount!: number;
}
