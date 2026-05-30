import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
}

export class StartMissionExecutionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  missionId!: string;
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
