import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HomeDashboardDto } from './dto/home-response.dto';
import { HomeService } from './home.service';
import type { HomeDashboard } from './home.types';

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
}
