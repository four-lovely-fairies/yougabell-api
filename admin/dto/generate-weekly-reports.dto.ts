import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class GenerateWeeklyReportsDto {
  @ApiPropertyOptional({
    example: '2026-05-04',
    description: '생성할 주차의 월요일. YYYY-MM-DD. 없으면 직전 완료 주차',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart?: string;

  @ApiPropertyOptional({
    default: false,
    description: '기존 리포트가 있을 때 삭제 후 재생성할지 여부',
  })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: '생성 대상만 계산하고 DB 쓰기/알림 생성을 하지 않을지 여부',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
