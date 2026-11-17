import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ChatMessageFeedbackRequestDto {
  @ApiProperty({
    description: '도움이 돼요 = true, 도움이 안돼요 = false',
    example: true,
  })
  @IsBoolean()
  helpful!: boolean;
}
