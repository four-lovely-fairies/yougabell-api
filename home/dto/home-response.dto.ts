import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const MISSION_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
const NOTIFICATION_ACTION_TYPES = [
  'none',
  'open_home',
  'open_mission',
  'open_roadmap',
  'open_chat',
  'open_report',
  'url',
] as const;
const NOTIFICATION_TARGET_TYPES = [
  'mission',
  'mission_execution',
  'weekly_report',
  'child',
  'chat_session',
  'url',
] as const;

export class HomeChildDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '김유스' })
  name!: string;

  @ApiProperty({ example: '2023-04-20', description: 'ISO date YYYY-MM-DD' })
  birthDate!: string;

  @ApiProperty({ example: '만3세' })
  ageLabel!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;
}

export class HomeMoodDto {
  @ApiProperty({ enum: [1, 2, 3, 4, 5], example: 4 })
  level!: 1 | 2 | 3 | 4 | 5;

  @ApiProperty({ example: '😊' })
  emoji!: string;
}

export class HomeWeekDayDto {
  @ApiProperty({ example: '2026-05-13', description: 'ISO date YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ enum: WEEKDAY_LABELS, example: '수' })
  weekdayLabel!: (typeof WEEKDAY_LABELS)[number];

  @ApiProperty({ example: 13 })
  dayOfMonth!: number;

  @ApiProperty()
  isToday!: boolean;

  @ApiPropertyOptional({ type: HomeMoodDto })
  mood?: HomeMoodDto;

  @ApiPropertyOptional()
  missionCompleted?: boolean;
}

export class HomeWeekDto {
  @ApiProperty({ example: '5월' })
  monthLabel!: string;

  @ApiProperty({ example: '2주차' })
  weekOfMonthLabel!: string;

  @ApiProperty({ type: [HomeWeekDayDto] })
  days!: HomeWeekDayDto[];
}

export class HomeRecommendedMissionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '아이 10분 가까워지기' })
  subThemeLabel!: string;

  @ApiProperty({ example: '아이와 눈을 마주치며 이야기를 해보아요' })
  title!: string;

  @ApiProperty({ example: 10 })
  durationMinutes!: number;

  @ApiProperty({ enum: MISSION_STATUSES })
  status!: (typeof MISSION_STATUSES)[number];
}

export class HomeGrowthStageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '자아 형성기' })
  name!: string;

  @ApiProperty()
  summary!: string;
}

export class HomeReportSummaryDto {
  @ApiProperty({ format: 'uuid' })
  reportId!: string;

  @ApiProperty({ example: '2026-05-04', description: 'ISO date YYYY-MM-DD' })
  weekStart!: string;

  @ApiProperty({ example: '2026-05-10', description: 'ISO date YYYY-MM-DD' })
  weekEnd!: string;

  @ApiProperty({ example: '지난주 아이와 함께한 놀이 시간' })
  title!: string;

  @ApiProperty({ example: 4620, minimum: 0 })
  totalDurationSeconds!: number;

  @ApiProperty({ example: '1시간 17분' })
  totalDurationLabel!: string;

  @ApiProperty({ example: 92, minimum: 0, maximum: 100 })
  childPositiveReactionRate!: number;
}

export class HomeNotificationSummaryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

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

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;
}

export class HomeNotificationsDto {
  @ApiProperty({ example: 2, minimum: 0 })
  unreadCount!: number;

  @ApiProperty({ type: [HomeNotificationSummaryItemDto] })
  latest!: HomeNotificationSummaryItemDto[];
}

export class HomeDashboardDto {
  @ApiProperty({ type: HomeChildDto })
  selectedChild!: HomeChildDto;

  @ApiProperty({ type: [HomeChildDto] })
  children!: HomeChildDto[];

  @ApiProperty({ type: HomeWeekDto })
  week!: HomeWeekDto;

  @ApiProperty({ type: HomeRecommendedMissionDto, nullable: true })
  recommendedMission!: HomeRecommendedMissionDto | null;

  @ApiProperty({ type: HomeGrowthStageDto, nullable: true })
  growthStage!: HomeGrowthStageDto | null;

  @ApiProperty({ type: HomeReportSummaryDto, nullable: true })
  reportSummary!: HomeReportSummaryDto | null;

  @ApiProperty({ type: HomeNotificationsDto })
  notifications!: HomeNotificationsDto;
}
