import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Gender,
  InterestId,
  NotificationSlot,
  WorkStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const INTEREST_VALUES = [
  'working_parent',
  'home_care',
  'language',
  'social',
  'physical',
  'cognition',
] satisfies InterestId[];

class ParentDto {
  @ApiProperty({ example: '홍길동', minLength: 1, maxLength: 30 })
  @IsString()
  @Length(1, 30)
  name!: string;

  @ApiProperty({ example: '1990-01-01', description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  birthDate!: string;

  @ApiProperty({ enum: ['female', 'male'] })
  @IsIn(['female', 'male'] satisfies Gender[])
  gender!: Gender;

  @ApiPropertyOptional({
    enum: ['working', 'full_time_caregiver'],
    nullable: true,
    description: '직장 유무 (선택)',
  })
  @IsOptional()
  @IsEnum(['working', 'full_time_caregiver'] satisfies WorkStatus[])
  workStatus?: WorkStatus | null;
}

class ChildInputDto {
  @ApiProperty({ example: '김유스', minLength: 1, maxLength: 30 })
  @IsString()
  @Length(1, 30)
  name!: string;

  @ApiProperty({ example: '2024-01-02' })
  @IsDateString()
  birthDate!: string;

  @ApiProperty({ enum: ['female', 'male'] })
  @IsIn(['female', 'male'] satisfies Gender[])
  gender!: Gender;

  @ApiPropertyOptional({
    description:
      '특이사항 자유 텍스트 (알레르기·발달 이슈 등). AI 챗봇 컨텍스트로 소비.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// v3: 단일 알림 시간대 선택 (Figma 2146:4530). v2 매트릭스(AppUsageSlotDto) 폐기.
class NotificationPreferenceDto {
  @ApiProperty({
    enum: ['morning', 'afternoon', 'evening', 'night', 'custom'],
    description:
      'preset(오전/오후/저녁/밤) 또는 custom(직접 입력). custom일 때 time 필수.',
  })
  @IsEnum([
    'morning',
    'afternoon',
    'evening',
    'night',
    'custom',
  ] satisfies NotificationSlot[])
  slot!: NotificationSlot;

  @ApiPropertyOptional({
    example: '08:00',
    description:
      'HH:MM (24h). custom일 때 필수, preset일 때 선택 — 미지정 시 시간대 디폴트.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:MM' })
  time?: string;
}

export class CompleteOnboardingDto {
  @ApiProperty({ type: ParentDto })
  @ValidateNested()
  @Type(() => ParentDto)
  parent!: ParentDto;

  @ApiProperty({ type: [ChildInputDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChildInputDto)
  children!: ChildInputDto[];

  @ApiPropertyOptional({
    type: NotificationPreferenceDto,
    description:
      '알림 시간대 (단일 선택, custom 옵션 포함). 권한 거부 또는 skip 시 미전송 가능.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferenceDto)
  notification?: NotificationPreferenceDto;

  @ApiPropertyOptional({
    description:
      '관심 주제 (최대 3개). 온보딩 02-04 화면(Figma 2146:4467) 결과.',
    enum: INTEREST_VALUES,
    isArray: true,
    example: ['working_parent', 'language'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(INTEREST_VALUES, { each: true })
  interests?: InterestId[];
}
