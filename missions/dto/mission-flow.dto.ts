import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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
