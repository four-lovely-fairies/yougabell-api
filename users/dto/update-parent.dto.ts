import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, WorkStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/** PATCH /me/parent — 본인 정보 수정 (Figma 2395:9320). 모든 필드 optional, 부분 갱신. */
export class UpdateParentDto {
  @ApiPropertyOptional({ example: '홍길동', minLength: 1, maxLength: 30 })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  name?: string;

  @ApiPropertyOptional({ example: '1990-01-01', description: 'ISO date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: ['female', 'male'] })
  @IsOptional()
  @IsIn(['female', 'male'] satisfies Gender[])
  gender?: Gender;

  @ApiPropertyOptional({
    enum: ['working', 'full_time_caregiver'],
    nullable: true,
  })
  @IsOptional()
  @IsEnum(['working', 'full_time_caregiver'] satisfies WorkStatus[])
  workStatus?: WorkStatus | null;
}
