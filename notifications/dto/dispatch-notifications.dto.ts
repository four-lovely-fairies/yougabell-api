import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsRFC3339,
  Max,
  Min,
} from 'class-validator';

export class DispatchNotificationsDto {
  @ApiPropertyOptional({
    example: '2026-06-01T12:00:00+09:00',
    description: '기준 시각 override. 없으면 현재 시각 사용',
  })
  @IsOptional()
  @IsRFC3339()
  now?: string;

  @ApiPropertyOptional({
    default: false,
    description: '생성 대상만 계산하고 Notification row는 쓰지 않을지 여부',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description:
      '현재 시각 기준 몇 분 전까지를 포함해 due time으로 볼지. 기본값 1',
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  windowMinutes?: number;
}
