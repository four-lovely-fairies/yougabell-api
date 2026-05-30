import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsRFC3339 } from 'class-validator';

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
}
