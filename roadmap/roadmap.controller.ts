import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetRoadmapQueryDto } from './dto/roadmap-query.dto';
import {
  MilestoneCompletionResponseDto,
  SetMilestoneCompletionDto,
} from './dto/milestone-completion.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { RoadmapService } from './roadmap.service';
import type {
  MilestoneCompletionResponse,
  RoadmapResponse,
} from './roadmap.types';

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

  @Patch('milestones/:milestoneId')
  @ApiOperation({ summary: '자녀별 발달 지표 체크 상태 저장' })
  @ApiOkResponse({ type: MilestoneCompletionResponseDto })
  setMilestoneCompletion(
    @CurrentUserId() userId: string,
    @Param('milestoneId', new ParseUUIDPipe({ version: '4' }))
    milestoneId: string,
    @Body() body: SetMilestoneCompletionDto,
  ): Promise<MilestoneCompletionResponse> {
    return this.service.setMilestoneCompletion(userId, milestoneId, body);
  }
}
