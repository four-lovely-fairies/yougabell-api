import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendTestPushDto {
  @ApiProperty({
    format: 'uuid',
    description: '푸시를 강제 발송할 대상 사용자 id',
  })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    description: '알림 제목. 없으면 기본 테스트 문구 사용',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: '알림 본문. 없으면 기본 테스트 문구 사용',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  body?: string;
}
