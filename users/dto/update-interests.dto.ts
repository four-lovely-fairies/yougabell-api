import { ApiProperty } from '@nestjs/swagger';
import { InterestId } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum } from 'class-validator';

const INTEREST_VALUES = [
  'working_parent',
  'home_care',
  'language',
  'social',
  'physical',
  'cognition',
] satisfies InterestId[];

/** PATCH /me/interests — 관심 주제 수정 (Figma 2395:9162). 최대 3개. */
export class UpdateInterestsDto {
  @ApiProperty({
    enum: INTEREST_VALUES,
    isArray: true,
    description: '관심 주제 ID 목록 (최대 3개)',
    example: ['working_parent', 'language'],
  })
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(INTEREST_VALUES, { each: true })
  interests!: InterestId[];
}
