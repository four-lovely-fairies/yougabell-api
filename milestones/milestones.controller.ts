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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  CreateMilestoneDto,
  ListMilestonesQueryDto,
  ListMilestonesResponseDto,
  MilestoneResponseDto,
  UpdateMilestoneDto,
} from './dto/milestone.dto';
import { MilestonesService } from './milestones.service';

@ApiTags('admin/milestones')
@ApiBearerAuth()
@Controller('admin/milestones')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
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
