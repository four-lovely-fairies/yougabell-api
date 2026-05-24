import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AGE_MONTH_MAX, AGE_MONTH_MIN } from '../roadmap.types';

export class GetRoadmapQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: '자녀 ID. 미지정 시 첫 번째 활성 자녀.',
  })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: AGE_MONTH_MIN,
    maximum: AGE_MONTH_MAX,
    description:
      '조회 대상 월령. 미지정 시 자녀 현재 월령. CDC 체크포인트가 아니면 가장 가까운 하단 월령으로 보정.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AGE_MONTH_MIN)
  @Max(AGE_MONTH_MAX)
  targetMonth?: number;
}
