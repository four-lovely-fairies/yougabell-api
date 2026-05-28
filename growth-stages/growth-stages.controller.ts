import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
  CreateGrowthStageDto,
  GrowthStageResponseDto,
  UpdateGrowthStageDto,
} from './dto/growth-stage.dto';
import { GrowthStagesService } from './growth-stages.service';

@ApiTags('admin/growth-stages')
@ApiBearerAuth()
@Controller('admin/growth-stages')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
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
