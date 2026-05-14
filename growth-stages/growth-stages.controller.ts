import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import {
  CreateGrowthStageDto,
  GrowthStageResponseDto,
  UpdateGrowthStageDto,
} from './dto/growth-stage.dto';
import { GrowthStagesService } from './growth-stages.service';

// TODO(auth): AdminGuard 도입 후 @UseGuards 복원. 현재는 dev only 무가드.
@ApiTags('admin/growth-stages')
@Controller('admin/growth-stages')
@SkipOnboardingCheck()
export class GrowthStagesController {
  constructor(private readonly service: GrowthStagesService) {}

  @Get()
  @ApiOkResponse({ type: GrowthStageResponseDto, isArray: true })
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOkResponse({ type: GrowthStageResponseDto })
  create(@Body() body: CreateGrowthStageDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: GrowthStageResponseDto })
  update(@Param('id') id: string, @Body() body: UpdateGrowthStageDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
