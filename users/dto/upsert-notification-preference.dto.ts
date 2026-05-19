import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/** PATCH /me/notifications/:type — 알림 종류별 enabled+time (Figma 2395:9126). */
export class UpsertNotificationPreferenceDto {
  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({
    example: '19:00',
    description: 'HH:MM (24h). 미지정 시 기존 값 유지(없으면 기본 09:00).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:MM' })
  time?: string;
}
