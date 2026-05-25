import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendChatMessageRequestDto {
  @ApiProperty({
    example: '아이가 잠들기 전 자꾸 한 번만 더 라고 해요',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
