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
  CreateMilestoneDto,
  ListMilestonesQueryDto,
  ListMilestonesResponseDto,
  MilestoneResponseDto,
  UpdateMilestoneDto,
} from './dto/milestone.dto';
import { MilestonesService } from './milestones.service';

// TODO(auth): AdminGuard 도입 후 @UseGuards 복원. 현재는 dev only 무가드.
@ApiTags('admin/milestones')
@Controller('admin/milestones')
@SkipOnboardingCheck()
export class MilestonesController {
  constructor(private readonly service: MilestonesService) {}

  @Get()
  @ApiOkResponse({ type: ListMilestonesResponseDto })
  list(@Query() query: ListMilestonesQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @ApiOkResponse({ type: MilestoneResponseDto })
  create(@Body() body: CreateMilestoneDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: MilestoneResponseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMilestoneDto,
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
