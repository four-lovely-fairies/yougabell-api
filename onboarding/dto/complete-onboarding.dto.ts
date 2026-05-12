import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, TimeSlot, Weekday, WorkStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

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

class AppUsageSlotDto {
  @ApiProperty({ enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] })
  @IsEnum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] satisfies Weekday[])
  dayOfWeek!: Weekday;

  @ApiProperty({
    enum: ['morning', 'afternoon', 'evening', 'night', 'all_day'],
  })
  @IsEnum([
    'morning',
    'afternoon',
    'evening',
    'night',
    'all_day',
  ] satisfies TimeSlot[])
  slot!: TimeSlot;
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

  @ApiProperty({
    type: [AppUsageSlotDto],
    description:
      '앱 사용 시간대 (요일 × 시간대). 빈 배열 허용 — 향후 정책 확정.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppUsageSlotDto)
  appUsage!: AppUsageSlotDto[];
}
