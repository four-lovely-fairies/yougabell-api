import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  AdminInquiryDetailDto,
  AdminInquiryListResponseDto,
  ListAdminInquiriesDto,
  UpdateInquiryDto,
} from './dto/admin-inquiry.dto';
import { AdminInquiriesService } from './admin-inquiries.service';

/** 운영자 전용 문의 관리 (docs/features/20260819-inquiry.md §4.1). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/inquiries')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@SkipOnboardingCheck()
export class AdminInquiriesController {
  constructor(private readonly service: AdminInquiriesService) {}

  @Get()
  @ApiOperation({
    summary: '문의 목록 (운영자)',
    description:
      '미답변 우선, 그 안에서 오래 기다린 순. status/category/q 필터.',
  })
  @ApiOkResponse({ type: AdminInquiryListResponseDto })
  listInquiries(
    @Query() query: ListAdminInquiriesDto,
  ): Promise<AdminInquiryListResponseDto> {
    return this.service.listInquiries(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '문의 상세 (운영자)',
    description: '답변 판단에 필요한 작성자 컨텍스트를 함께 반환한다.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AdminInquiryDetailDto })
  @ApiNotFoundResponse({ description: 'INQUIRY_NOT_FOUND' })
  getInquiry(@Param('id') id: string): Promise<AdminInquiryDetailDto> {
    return this.service.getInquiry(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '상태 변경 / 답변 저장 (운영자)',
    description:
      'answerBody가 오면 상태를 answered로 전환하고 첫 답변일 때만 사용자 알림을 만든다.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AdminInquiryDetailDto })
  @ApiBadRequestResponse({ description: 'ANSWER_BODY_REQUIRED' })
  @ApiNotFoundResponse({ description: 'INQUIRY_NOT_FOUND' })
  updateInquiry(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateInquiryDto,
  ): Promise<AdminInquiryDetailDto> {
    return this.service.updateInquiry(admin.id, id, body);
  }
}
