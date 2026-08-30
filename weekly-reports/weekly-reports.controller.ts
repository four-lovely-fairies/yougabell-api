import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  WeeklyReportCurrentResponseDto,
  WeeklyReportDetailDto,
  WeeklyReportUnviewedStatusDto,
  WeeklyReportViewedResponseDto,
} from './dto/weekly-report-response.dto';
import { WeeklyReportsService } from './weekly-reports.service';
import type {
  WeeklyReportCurrentResponse,
  WeeklyReportDetail,
  WeeklyReportUnviewedStatus,
  WeeklyReportViewedResponse,
} from './weekly-reports.types';

@ApiTags('weekly-reports')
@ApiBearerAuth()
@Controller('weekly-reports')
@UseGuards(JwtAuthGuard)
export class WeeklyReportsController {
  constructor(private readonly weeklyReportsService: WeeklyReportsService) {}

  @Get('current')
  @ApiQuery({ name: 'childId', required: false, type: String, format: 'uuid' })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    type: String,
    example: '2026-05-04',
    description: '조회할 주차의 월요일. YYYY-MM-DD',
  })
  @ApiOkResponse({ type: WeeklyReportCurrentResponseDto })
  getCurrent(
    @CurrentUserId() userId: string,
    @Query('childId') childId?: string,
    @Query('weekStart') weekStart?: string,
  ): Promise<WeeklyReportCurrentResponse> {
    return this.weeklyReportsService.getCurrent(userId, {
      childId,
      weekStart,
    });
  }

  @Get('unviewed-status')
  @ApiQuery({ name: 'childId', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ type: WeeklyReportUnviewedStatusDto })
  getUnviewedStatus(
    @CurrentUserId() userId: string,
    @Query('childId') childId?: string,
  ): Promise<WeeklyReportUnviewedStatus> {
    return this.weeklyReportsService.getUnviewedStatus(userId, { childId });
  }

  @Patch(':id/viewed')
  @ApiOkResponse({ type: WeeklyReportViewedResponseDto })
  markViewed(
    @CurrentUserId() userId: string,
    @Param('id') reportId: string,
  ): Promise<WeeklyReportViewedResponse> {
    return this.weeklyReportsService.markViewed(userId, reportId);
  }

  @Get(':id')
  @ApiOkResponse({ type: WeeklyReportDetailDto })
  getById(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<WeeklyReportDetail> {
    return this.weeklyReportsService.getById(userId, id);
  }
}
