import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatMessageFeedbackRequestDto } from './dto/chat-feedback-request.dto';
import { SendChatMessageRequestDto } from './dto/chat-message-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import type { ChatResponse } from './chat.types';

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

  /**
   * SSE 스트리밍 엔드포인트 — Phase 2.
   * Content-Type: text/event-stream
   * 이벤트: token / done / error  (기획 §4.1)
   *
   * 표준 EventSource는 GET만 지원하므로 web은 fetch + ReadableStream 파싱 사용.
   */
  @Post('messages/stream')
  @ApiProduces('text/event-stream')
  async stream(
    @CurrentUserId() userId: string,
    @Body() body: SendChatMessageRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Render/nginx 프록시 버퍼 해제
    res.flushHeaders?.();

    try {
      for await (const event of this.service.streamMessage(
        userId,
        body.content,
      )) {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }
    } catch {
      res.write('event: error\n');
      res.write(
        `data: ${JSON.stringify({ message: '응답 스트림이 끊겼어요. 다시 시도해 주세요.' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  /** AI 답변 피드백 — 도움이 돼요(true) / 도움이 안돼요(false). 다시 보내면 마지막 값으로 갱신. */
  @Put('messages/:messageId/feedback')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: '본인 대화의 AI 답변이 아님' })
  setFeedback(
    @CurrentUserId() userId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() body: ChatMessageFeedbackRequestDto,
  ): Promise<void> {
    return this.service.setMessageFeedback(userId, messageId, body.helpful);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUserId() userId: string): Promise<void> {
    return this.service.deleteChat(userId);
  }
}
