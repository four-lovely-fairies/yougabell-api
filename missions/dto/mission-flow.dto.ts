import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GetCurrentMissionQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  childId?: string;
}

export class MissionSelectedChildDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'date' })
  birthDate!: string;

  @ApiProperty()
  ageLabel!: string;
}

export class CurrentMissionDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  subThemeLabel!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ minimum: 1 })
  durationMinutes!: number;

  @ApiProperty()
  durationLabel!: string;

  @ApiProperty()
  categoryLabel!: string;

  @ApiProperty()
  sourceLabel!: string;

  @ApiProperty({ enum: ['not_started', 'in_progress', 'completed'] })
  status!: 'not_started' | 'in_progress' | 'completed';

  @ApiProperty({ description: '관심 놀이로 저장했는지' })
  isFavorite!: boolean;
}

// 오늘 이미 완료한 실행 — 놀이 상세 재진입 시 "피드백 작성하기" 노출 여부 판단용.
export class CompletedMissionExecutionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  hasFeedback!: boolean;
}

export class ActiveMissionExecutionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['in_progress', 'paused'] })
  status!: 'in_progress' | 'paused';

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  activeSegmentStartedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pausedAt!: string | null;

  @ApiProperty({ minimum: 1 })
  durationMinutes!: number;

  @ApiProperty({ minimum: 0 })
  elapsedSeconds!: number;

  @ApiProperty({ minimum: 0 })
  remainingSeconds!: number;
}

export class GetCurrentMissionResponseDto {
  @ApiProperty({ type: MissionSelectedChildDto })
  selectedChild!: MissionSelectedChildDto;

  @ApiProperty({ type: [MissionSelectedChildDto] })
  children!: MissionSelectedChildDto[];

  @ApiProperty({ type: CurrentMissionDetailDto })
  mission!: CurrentMissionDetailDto;

  @ApiProperty({ type: ActiveMissionExecutionDto, nullable: true })
  activeExecution!: ActiveMissionExecutionDto | null;

  @ApiProperty({ type: CompletedMissionExecutionDto, nullable: true })
  completedExecution!: CompletedMissionExecutionDto | null;
}

export class StartMissionExecutionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  missionId!: string;
}

export class ResetMissionExecutionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId!: string;
}

export class ResetMissionExecutionResponseDto {
  @ApiProperty({ example: 1, description: '삭제된 오늘 미션 실행 수' })
  deletedCount!: number;
}

export class MissionExecutionSnapshotDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  missionId!: string;

  @ApiProperty({ format: 'uuid' })
  childId!: string;

  @ApiProperty({ enum: ['in_progress', 'paused'] })
  status!: 'in_progress' | 'paused';

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  activeSegmentStartedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pausedAt!: string | null;

  @ApiProperty({ minimum: 1 })
  durationMinutes!: number;

  @ApiProperty({ minimum: 0 })
  elapsedSeconds!: number;

  @ApiProperty({ minimum: 0 })
  remainingSeconds!: number;

  @ApiProperty({ format: 'date-time' })
  serverNow!: string;
}

export class MissionExecutionSnapshotResponseDto {
  @ApiProperty({ type: MissionExecutionSnapshotDto, nullable: true })
  execution!: MissionExecutionSnapshotDto | null;
}

export class GetActiveMissionExecutionQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  childId?: string;
}

export class MissionExecutionActionBodyDto {
  @ApiProperty({
    enum: ['pause', 'resume', 'complete', 'early_complete'],
  })
  @IsString()
  @IsIn(['pause', 'resume', 'complete', 'early_complete'])
  action!: 'pause' | 'resume' | 'complete' | 'early_complete';

  // 타이머 없이 "놀이 다 했어요"로 완료할 때, 놀이 상세 화면에 들어온 뒤 버튼을 누를 때까지 걸린 시간(초).
  // complete에서만 쓰이고, 서버가 잰 시간보다 길 때만 반영한다(미션 시간으로 상한).
  @ApiPropertyOptional({ minimum: 0, maximum: 86400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  elapsedSeconds?: number;
}

export class MissionExecutionEffectDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['completed', 'early_completed'] })
  status!: 'completed' | 'early_completed';

  @ApiProperty({ format: 'date-time' })
  completedAt!: string;

  @ApiProperty({ minimum: 0 })
  actualDurationSeconds!: number;

  @ApiProperty()
  wasEarlyCompleted!: boolean;
}

export class MissionEffectDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  effect!: string;

  @ApiProperty({ type: String, nullable: true })
  goal!: string | null;

  @ApiProperty({ type: String, nullable: true })
  subThemeLabel!: string | null;
}

export class GetMissionExecutionEffectResponseDto {
  @ApiProperty({ type: MissionExecutionEffectDto })
  execution!: MissionExecutionEffectDto;

  @ApiProperty({ type: MissionEffectDetailDto })
  mission!: MissionEffectDetailDto;
}

export class UpsertMissionFeedbackDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  childReaction!: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsInt()
  @Min(0)
  @Max(10)
  parentEnergy!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  missionSatisfaction!: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class MissionFeedbackResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  executionId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  childReaction!: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  parentEnergy!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  missionSatisfaction!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: [String] })
  keywords!: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class UpsertMissionFeedbackResponseDto {
  @ApiProperty({ type: MissionFeedbackResponseDto })
  feedback!: MissionFeedbackResponseDto;
}

// ============================================================
// 관심 놀이 · 놀이 내역 목록 공통 쿼리
// ============================================================

export class MissionLibraryQueryDto {
  @ApiPropertyOptional({ enum: ['latest', 'oldest'], default: 'latest' })
  @IsOptional()
  @IsIn(['latest', 'oldest'])
  order?: 'latest' | 'oldest';

  @ApiPropertyOptional({ description: '놀이 제목 검색어', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @ApiPropertyOptional({
    description: '발달 영역 id (social, language, cognitive, physical)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class MissionHistoryQueryDto extends MissionLibraryQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: '없으면 모든 아이' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      '이 시각 이후(포함)에 완료한 놀이만 — 예: 달력에서 고른 달의 1일 0시',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: '이 시각 이전(미포함)에 완료한 놀이만 — 예: 다음 달 1일 0시',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MissionLibraryItemDto {
  @ApiProperty({ format: 'uuid' })
  missionId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  shortTitle!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  durationLabel!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  categoryLabel!: string;

  @ApiProperty()
  isFavorite!: boolean;
}

export class FavoriteMissionItemDto extends MissionLibraryItemDto {
  @ApiProperty({ format: 'date-time' })
  savedAt!: string;
}

export class ListFavoriteMissionsResponseDto {
  @ApiProperty({ type: [FavoriteMissionItemDto] })
  items!: FavoriteMissionItemDto[];

  @ApiProperty()
  total!: number;
}

export class MissionHistoryItemDto extends MissionLibraryItemDto {
  @ApiProperty({ format: 'uuid' })
  executionId!: string;

  @ApiProperty({ format: 'uuid' })
  childId!: string;

  @ApiProperty({ enum: ['completed', 'early_completed'] })
  status!: 'completed' | 'early_completed';

  @ApiProperty({ format: 'date-time' })
  completedAt!: string;

  @ApiProperty({ type: Number, nullable: true })
  actualDurationSeconds!: number | null;

  @ApiProperty()
  hasFeedback!: boolean;
}

export class ListMissionHistoryResponseDto {
  @ApiProperty({ type: [MissionHistoryItemDto] })
  items!: MissionHistoryItemDto[];

  @ApiProperty()
  total!: number;
}

export class FavoriteMissionStateDto {
  @ApiProperty({ format: 'uuid' })
  missionId!: string;

  @ApiProperty()
  isFavorite!: boolean;
}
