import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendChatMessageRequestDto } from './dto/chat-message-request.dto';
import {
  ChatResponseDto,
  SendChatMessageResponseDto,
} from './dto/chat-response.dto';
import type { ChatResponse, SendChatMessageResponse } from './chat.types';

@ApiTags('me/chat')
@ApiBearerAuth()
@Controller('me/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get()
  @ApiOkResponse({ type: ChatResponseDto })
  get(@CurrentUserId() userId: string): Promise<ChatResponse> {
    return this.service.getChat(userId);
  }

  @Post('messages')
  @ApiOkResponse({ type: SendChatMessageResponseDto })
  send(
    @CurrentUserId() userId: string,
    @Body() body: SendChatMessageRequestDto,
  ): Promise<SendChatMessageResponse> {
    return this.service.sendMessage(userId, body.content);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUserId() userId: string): Promise<void> {
    return this.service.deleteChat(userId);
  }
}
