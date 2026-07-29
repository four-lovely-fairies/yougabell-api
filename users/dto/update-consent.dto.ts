import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateConsentDto {
  @ApiProperty({
    description:
      '동의 여부. append-only라 매번 새 이력 row가 쌓인다 (철회 시각도 근거로 남는다).',
  })
  @IsBoolean()
  agreed!: boolean;
}
