import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SATISFACTION_SURVEY_DISCOVERY_SOURCES,
  SATISFACTION_SURVEY_LIKED_OPTIONS,
} from '../surveys.constants';

export class SatisfactionSurveyStatusDto {
  @ApiProperty({ example: 'satisfaction-2026-08' })
  campaignKey!: string;

  @ApiProperty()
  hasAnyMissionExecution!: boolean;

  @ApiProperty()
  shouldShowPrompt!: boolean;

  @ApiProperty({ example: 0, minimum: 0 })
  promptShownCount!: number;

  @ApiProperty({ example: 2, minimum: 1 })
  maxPromptShows!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  submittedAt!: string | null;
}

export class SatisfactionSurveyPromptStateDto extends SatisfactionSurveyStatusDto {
  @ApiProperty({ example: 0, minimum: 0 })
  dismissedCount!: number;
}

export class SubmitSatisfactionSurveyDto {
  @ApiProperty({ enum: SATISFACTION_SURVEY_DISCOVERY_SOURCES })
  @IsIn(SATISFACTION_SURVEY_DISCOVERY_SOURCES)
  discoverySource!: (typeof SATISFACTION_SURVEY_DISCOVERY_SOURCES)[number];

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  experienceRating!: number;

  @ApiProperty({
    enum: SATISFACTION_SURVEY_LIKED_OPTIONS,
    isArray: true,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SATISFACTION_SURVEY_LIKED_OPTIONS, { each: true })
  likedOptions!: Array<(typeof SATISFACTION_SURVEY_LIKED_OPTIONS)[number]>;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  improvementText?: string;

  @ApiPropertyOptional({
    description: '커피 쿠폰 지급을 원하는 경우 연락처와 이름을 함께 입력.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string;
}

export class SatisfactionSurveyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'satisfaction-2026-08' })
  campaignKey!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
