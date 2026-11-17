import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  GetActiveMissionExecutionQueryDto,
  GetCurrentMissionQueryDto,
  GetCurrentMissionResponseDto,
  FavoriteMissionStateDto,
  GetMissionExecutionEffectResponseDto,
  ListFavoriteMissionsResponseDto,
  ListMissionHistoryResponseDto,
  MissionHistoryQueryDto,
  MissionLibraryQueryDto,
  MissionExecutionActionBodyDto,
  MissionExecutionSnapshotResponseDto,
  ResetMissionExecutionDto,
  ResetMissionExecutionResponseDto,
  StartMissionExecutionDto,
  UpsertMissionFeedbackDto,
  UpsertMissionFeedbackResponseDto,
} from './dto/mission-flow.dto';
import { MissionsService } from './missions.service';

@ApiTags('missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MissionFlowController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get('missions/current')
  @ApiOkResponse({ type: GetCurrentMissionResponseDto })
  getCurrentMission(
    @CurrentUserId() userId: string,
    @Query() query: GetCurrentMissionQueryDto,
  ) {
    return this.missionsService.getCurrentMission(userId, query);
  }

  // 관심 놀이 목록
  @Get('missions/favorites')
  @ApiOkResponse({ type: ListFavoriteMissionsResponseDto })
  listFavoriteMissions(
    @CurrentUserId() userId: string,
    @Query() query: MissionLibraryQueryDto,
  ) {
    return this.missionsService.listFavoriteMissions(userId, query);
  }

  @Put('missions/:id/favorite')
  @ApiOkResponse({ type: FavoriteMissionStateDto })
  addFavoriteMission(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.missionsService.setFavoriteMission(userId, id, true);
  }

  @Delete('missions/:id/favorite')
  @ApiOkResponse({ type: FavoriteMissionStateDto })
  removeFavoriteMission(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.missionsService.setFavoriteMission(userId, id, false);
  }

  // 놀이 내역 — 완료한 놀이 목록. ':id' 경로보다 먼저 선언해 겹치지 않게 한다.
  @Get('mission-executions/history')
  @ApiOkResponse({ type: ListMissionHistoryResponseDto })
  listMissionHistory(
    @CurrentUserId() userId: string,
    @Query() query: MissionHistoryQueryDto,
  ) {
    return this.missionsService.listMissionHistory(userId, query);
  }

  @Post('mission-executions')
  @ApiOkResponse({ type: MissionExecutionSnapshotResponseDto })
  startMissionExecution(
    @CurrentUserId() userId: string,
    @Body() body: StartMissionExecutionDto,
  ) {
    return this.missionsService.startMissionExecution(userId, body);
  }

  @Post('mission-executions/reset')
  @ApiOkResponse({ type: ResetMissionExecutionResponseDto })
  resetTodayMissionExecution(
    @CurrentUserId() userId: string,
    @Body() body: ResetMissionExecutionDto,
  ) {
    return this.missionsService.resetTodayMissionExecution(
      userId,
      body.childId,
    );
  }

  @Get('mission-executions/active')
  @ApiOkResponse({ type: MissionExecutionSnapshotResponseDto })
  getActiveMissionExecution(
    @CurrentUserId() userId: string,
    @Query() query: GetActiveMissionExecutionQueryDto,
  ) {
    return this.missionsService.getActiveMissionExecution(userId, query);
  }

  @Post('mission-executions/:id/action')
  @ApiOkResponse({ type: MissionExecutionSnapshotResponseDto })
  applyMissionExecutionAction(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MissionExecutionActionBodyDto,
  ) {
    return this.missionsService.applyMissionExecutionAction(
      userId,
      id,
      body.action,
      body.elapsedSeconds,
    );
  }

  @Get('mission-executions/:id/effect')
  @ApiOkResponse({ type: GetMissionExecutionEffectResponseDto })
  getMissionExecutionEffect(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.missionsService.getMissionExecutionEffect(userId, id);
  }

  @Put('mission-executions/:id/feedback')
  @ApiOkResponse({ type: UpsertMissionFeedbackResponseDto })
  upsertMissionFeedback(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpsertMissionFeedbackDto,
  ) {
    return this.missionsService.upsertMissionFeedback(userId, id, body);
  }
}
