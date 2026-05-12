import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type OnboardedFilter = 'true' | 'false' | 'all';

export class ListUsersDto {
  @ApiPropertyOptional({
    enum: ['true', 'false', 'all'],
    description: '온보딩 필터. default true (완료자만)',
  })
  @IsOptional()
  @IsIn(['true', 'false', 'all'])
  onboarded?: OnboardedFilter;

  @ApiPropertyOptional({ description: '이름 LIKE 검색' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: '1-based', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: '페이지당 항목',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
