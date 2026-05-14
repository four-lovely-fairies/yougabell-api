import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export class CreateGrowthStageDto {
  @ApiProperty({
    example: 'self-formation',
    description: 'slug (lowercase, 영문/숫자/하이픈)',
  })
  @IsString()
  @Length(2, 64)
  @Matches(SLUG_PATTERN, {
    message: 'id must be lowercase slug (a-z, 0-9, hyphen).',
  })
  id!: string;

  @ApiProperty({ example: '자아 형성기' })
  @IsString()
  @Length(1, 64)
  name!: string;

  @ApiProperty({ minimum: 0, example: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsFrom!: number;

  @ApiProperty({ minimum: 0, example: 12 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsTo!: number;

  @ApiProperty({ example: '아이가 "나"라는 인식을 만들어가는 시기' })
  @IsString()
  @MaxLength(2000)
  summary!: string;
}

export class UpdateGrowthStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 64)
  name?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsFrom?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsTo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

export class GrowthStageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ageMonthsFrom!: number;

  @ApiProperty()
  ageMonthsTo!: number;

  @ApiProperty()
  summary!: string;
}
