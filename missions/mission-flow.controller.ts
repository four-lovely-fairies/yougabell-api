import {
  Body,
  Controller,
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
  GetMissionExecutionEffectResponseDto,
  MissionExecutionActionBodyDto,
  MissionExecutionSnapshotResponseDto,
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

  @Post('mission-executions')
  @ApiOkResponse({ type: MissionExecutionSnapshotResponseDto })
  startMissionExecution(
    @CurrentUserId() userId: string,
    @Body() body: StartMissionExecutionDto,
  ) {
    return this.missionsService.startMissionExecution(userId, body);
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
