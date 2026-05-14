import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMissionDto {
  @ApiProperty({ example: 'play' })
  @IsString()
  @Length(1, 64)
  categoryId!: string;

  @ApiProperty({ example: '아이와 10분 가까워지기' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: '10분 아이컨텍' })
  @IsString()
  @MaxLength(60)
  shortTitle!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ minimum: 1, example: 10 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMinutes!: number;

  @ApiProperty({ example: '정서적 안정감' })
  @IsString()
  @MaxLength(120)
  effect!: string;

  @ApiPropertyOptional({ example: '아이와 가까워지기' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subThemeLabel?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  recommendedAgeMonthsMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  recommendedAgeMonthsMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['감정', '말놀이'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateMissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 64)
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shortTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  effect?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subThemeLabel?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  recommendedAgeMonthsMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  recommendedAgeMonthsMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}

export class ListMissionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      '월령 N이 [recommendedAgeMonthsMin, recommendedAgeMonthsMax] 안인 미션만',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonths?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize?: number;
}

export class MissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  shortTitle!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  effect!: string;

  @ApiProperty({ type: String, nullable: true })
  subThemeLabel!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  recommendedAgeMonthsMin!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  recommendedAgeMonthsMax!: number | null;

  @ApiProperty({ type: String, nullable: true })
  thumbnailUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  videoUrl!: string | null;

  @ApiProperty({ type: String, isArray: true })
  tags!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ListMissionsResponseDto {
  @ApiProperty({ type: MissionResponseDto, isArray: true })
  items!: MissionResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
