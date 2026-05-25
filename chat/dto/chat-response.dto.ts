import { ApiProperty } from '@nestjs/swagger';

const CHAT_ROLES = ['user', 'assistant'] as const;
const CARD_ACTIONS = [
  'none',
  'start_mission',
  'open_link',
  'follow_up',
] as const;

export class ChatMessageCardDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 0, minimum: 0 })
  order!: number;

  @ApiProperty({ example: '잠자리 티켓' })
  title!: string;

  @ApiProperty({ example: '실물 티켓 한 장을 주세요...' })
  body!: string;

  @ApiProperty({ enum: CARD_ACTIONS, nullable: true })
  actionType!: (typeof CARD_ACTIONS)[number] | null;

  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'actionType에 따라 polymorphic',
  })
  actionPayload!: Record<string, unknown> | null;
}

export class ChatMessageSourceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'https://www.cdc.gov/ncbddd/actearly/milestones' })
  url!: string;

  @ApiProperty({ example: 'cdc.gov' })
  domain!: string;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;
}

export class ChatMessageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CHAT_ROLES })
  role!: (typeof CHAT_ROLES)[number];

  @ApiProperty({
    example: '그 "딱 하나만 더"라는 요청이 얼마나 진을 빼놓는지 ...',
  })
  content!: string;

  @ApiProperty({ format: 'date-time' })
  sentAt!: string;

  @ApiProperty({ type: [ChatMessageCardDto] })
  cards!: ChatMessageCardDto[];

  @ApiProperty({ type: [ChatMessageSourceDto] })
  sources!: ChatMessageSourceDto[];
}

export class ChatSessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ChatResponseDto {
  @ApiProperty({ type: ChatSessionDto, nullable: true })
  session!: ChatSessionDto | null;

  @ApiProperty({ type: [ChatMessageDto] })
  messages!: ChatMessageDto[];
}
