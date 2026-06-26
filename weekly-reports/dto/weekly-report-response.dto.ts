import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const EMPTY_REASONS = [
  'no_mission_yet',
  'no_mission_for_week',
  'report_generation_pending',
] as const;

export class WeeklyReportSelectedChildDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '김유스' })
  name!: string;

  @ApiProperty({ example: '36개월' })
  ageLabel!: string;
}

export class WeeklyReportEmptyStateDto {
  @ApiProperty({ enum: EMPTY_REASONS })
  reason!: (typeof EMPTY_REASONS)[number];

  @ApiProperty({ example: '아직 주간 리포트가 없습니다' })
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ example: '놀이 시작하기' })
  ctaLabel!: '놀이 시작하기';

  @ApiProperty({ example: '/mission' })
  ctaHref!: '/mission';
}

export class WeeklyReportHeadlineDto {
  @ApiProperty({ example: '나는 잘하고 있는가?' })
  question!: '나는 잘하고 있는가?';

  @ApiProperty({ example: '지금 충분히 잘하고 계십니다.' })
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  body!: string | null;
}

export class WeeklyReportDayDto {
  @ApiProperty({ enum: WEEKDAYS })
  weekday!: (typeof WEEKDAYS)[number];

  @ApiProperty({ enum: WEEKDAY_LABELS })
  label!: (typeof WEEKDAY_LABELS)[number];

  @ApiProperty({ minimum: 0 })
  completedCount!: number;

  @ApiProperty()
  completed!: boolean;
}

export class WeeklyReportMissionSummaryDto {
  @ApiProperty({ type: [WeeklyReportDayDto] })
  days!: WeeklyReportDayDto[];

  @ApiProperty({ minimum: 0 })
  totalDurationSeconds!: number;

  @ApiProperty({ example: '1시간 17분' })
  totalDurationLabel!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  childPositiveReactionRate!: number;
}

export class WeeklyReportKeywordDto {
  @ApiProperty({ enum: [1, 2, 3] })
  rank!: 1 | 2 | 3;

  @ApiProperty({ example: '공룡' })
  keyword!: string;
}

export class WeeklyReportKeywordEmptyStateDto {
  @ApiProperty({ example: '아직 키워드가 충분하지 않아요' })
  title!: '아직 키워드가 충분하지 않아요';

  @ApiProperty()
  description!: string;
}

export class WeeklyReportBestMomentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ minimum: 1 })
  order!: number;

  @ApiPropertyOptional({ example: '순수한 기쁨' })
  label?: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;
}

export class WeeklyReportInnerStateDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  psychologicalEnergy!: number;

  @ApiProperty({ example: '기분 전환을 위한 팁' })
  tipTitle!: string;

  @ApiPropertyOptional()
  tipBody?: string;
}

export class WeeklyReportAiActionSuggestionDto {
  @ApiProperty({ example: '미래 행동 제안 (AI 기반)' })
  title!: '미래 행동 제안 (AI 기반)';

  @ApiProperty()
  body!: string;
}

export class WeeklyReportDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-05-04' })
  weekStart!: string;

  @ApiProperty({ example: '2026-05-10' })
  weekEnd!: string;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ type: WeeklyReportHeadlineDto })
  headline!: WeeklyReportHeadlineDto;

  @ApiProperty({ type: WeeklyReportMissionSummaryDto })
  missionSummary!: WeeklyReportMissionSummaryDto;

  @ApiProperty({ type: [WeeklyReportKeywordDto] })
  topKeywords!: WeeklyReportKeywordDto[];

  @ApiProperty({ type: WeeklyReportKeywordEmptyStateDto, nullable: true })
  keywordEmptyState!: WeeklyReportKeywordEmptyStateDto | null;

  @ApiProperty({ type: [WeeklyReportBestMomentDto] })
  bestMoments!: WeeklyReportBestMomentDto[];

  @ApiProperty({ type: WeeklyReportInnerStateDto })
  innerState!: WeeklyReportInnerStateDto;

  @ApiProperty({ type: WeeklyReportAiActionSuggestionDto })
  aiActionSuggestion!: WeeklyReportAiActionSuggestionDto;
}

export class WeeklyReportCurrentResponseDto {
  @ApiProperty({ type: WeeklyReportSelectedChildDto })
  selectedChild!: WeeklyReportSelectedChildDto;

  @ApiProperty({ type: WeeklyReportDetailDto, nullable: true })
  report!: WeeklyReportDetailDto | null;

  @ApiProperty({ type: WeeklyReportEmptyStateDto, nullable: true })
  emptyState!: WeeklyReportEmptyStateDto | null;
}
