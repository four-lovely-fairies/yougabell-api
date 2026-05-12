import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HomeService } from './home.service';
import type { HomeDashboard } from './home.types';

@Controller('home')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  getHome(
    @CurrentUserId() userId: string,
    @Query('childId') childId?: string,
    @Query('date') date?: string,
  ): Promise<HomeDashboard> {
    return this.homeService.getHome(userId, { childId, date });
  }
}
