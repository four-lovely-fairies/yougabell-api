import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  CreateMissionDto,
  ListMissionsQueryDto,
  ListMissionsResponseDto,
  MissionResponseDto,
  UpdateMissionDto,
} from './dto/mission.dto';
import { MissionsService } from './missions.service';

// TODO(auth): AdminGuard 도입 후 @UseGuards 복원. 현재는 dev only 무가드.
@ApiTags('admin/missions')
@Controller('admin/missions')
@SkipOnboardingCheck()
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  @ApiOkResponse({ type: ListMissionsResponseDto })
  list(@Query() query: ListMissionsQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @ApiOkResponse({ type: MissionResponseDto })
  create(@Body() body: CreateMissionDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: MissionResponseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMissionDto,
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
