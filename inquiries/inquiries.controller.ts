import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  CreateInquiryDto,
  InquiryListResponseDto,
  InquiryResponseDto,
  ListInquiriesDto,
} from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

/**
 * 1:1 문의 (docs/features/20260819-inquiry.md).
 *
 * 온보딩 중에도 문의할 수 있어야 하므로 온보딩 완료 가드는 스킵한다.
 */
@ApiTags('inquiries')
@ApiBearerAuth()
@Controller('inquiries')
@UseGuards(JwtAuthGuard)
@SkipOnboardingCheck()
export class InquiriesController {
  constructor(private readonly service: InquiriesService) {}

  @Post()
  @ApiOperation({
    summary: '문의 등록',
    description:
      'contactEmail 미지정 시 로그인 이메일을 사용한다. 미답변 문의가 5건 이상이면 409.',
  })
  @ApiCreatedResponse({ type: InquiryResponseDto })
  @ApiConflictResponse({ description: 'TOO_MANY_OPEN_INQUIRIES' })
  createInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInquiryDto,
  ): Promise<InquiryResponseDto> {
    return this.service.createInquiry(user.id, body, user.email);
  }

  @Get()
  @ApiOperation({
    summary: '내 문의 목록',
    description: '최신순. 목록에는 본문·답변 전문을 싣지 않는다.',
  })
  @ApiOkResponse({ type: InquiryListResponseDto })
  listInquiries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInquiriesDto,
  ): Promise<InquiryListResponseDto> {
    return this.service.listInquiries(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '내 문의 상세' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: InquiryResponseDto })
  @ApiNotFoundResponse({ description: 'INQUIRY_NOT_FOUND (타인 문의 포함)' })
  getInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InquiryResponseDto> {
    return this.service.getInquiry(user.id, id);
  }
}
