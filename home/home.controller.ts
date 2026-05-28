import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  HomeDashboardDto,
  HomeMoodCheckDto,
  UpsertHomeMoodDto,
} from './dto/home-response.dto';
import { HomeService } from './home.service';
import type { HomeDashboard, HomeMoodCheck } from './home.types';

@ApiTags('home')
@ApiBearerAuth()
@Controller('home')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiQuery({ name: 'childId', required: false, type: String, format: 'uuid' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-05-13',
    description: '홈 기준일. YYYY-MM-DD',
  })
  @ApiOkResponse({ type: HomeDashboardDto })
  getHome(
    @CurrentUserId() userId: string,
    @Query('childId') childId?: string,
    @Query('date') date?: string,
  ): Promise<HomeDashboard> {
    return this.homeService.getHome(userId, { childId, date });
  }

  @Post('mood')
  @ApiOkResponse({ type: HomeMoodCheckDto })
  upsertTodayMood(
    @CurrentUserId() userId: string,
    @Body() body: UpsertHomeMoodDto,
  ): Promise<HomeMoodCheck> {
    return this.homeService.upsertTodayMood(userId, body.level);
  }
}
