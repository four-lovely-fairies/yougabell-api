import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetRoadmapQueryDto } from './dto/roadmap-query.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { RoadmapService } from './roadmap.service';
import type { RoadmapResponse } from './roadmap.types';

@ApiTags('me/roadmap')
@ApiBearerAuth()
@Controller('me/roadmap')
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(private readonly service: RoadmapService) {}

  @Get()
  @ApiOkResponse({ type: RoadmapResponseDto })
  get(
    @CurrentUserId() userId: string,
    @Query() query: GetRoadmapQueryDto,
  ): Promise<RoadmapResponse> {
    return this.service.getRoadmap(userId, query);
  }
}
