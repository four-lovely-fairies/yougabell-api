import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StatsQueryDto {
  @ApiPropertyOptional({
    description: '집계 기간(일). 오늘 포함 최근 N일 (KST 기준)',
    minimum: 1,
    maximum: 180,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  days?: number;
}
