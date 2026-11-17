import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatMessageFeedbackRequestDto {
  @ApiProperty({
    description: '도움이 돼요 = true, 도움이 안돼요 = false',
    example: true,
  })
  @IsBoolean()
  helpful!: boolean;

  @ApiProperty({
    description:
      '도움이 안돼요일 때 "어떤 점이 아쉬웠나요?"에 적은 내용. 도움이 돼요로 바꾸면 지워진다.',
    required: false,
    maxLength: 500,
    example: '알림 설정을 찾고 싶었는데 못 찾았어요.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
