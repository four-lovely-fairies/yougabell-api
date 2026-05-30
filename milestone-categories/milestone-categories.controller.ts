import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { MilestoneCategoryResponseDto } from './dto/milestone-category.dto';
import { MilestoneCategoriesService } from './milestone-categories.service';

@ApiTags('admin/categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@SkipOnboardingCheck()
export class MilestoneCategoriesController {
  constructor(private readonly service: MilestoneCategoriesService) {}

  @Get()
  @ApiOkResponse({ type: MilestoneCategoryResponseDto, isArray: true })
  list(): Promise<MilestoneCategoryResponseDto[]> {
    return this.service.list();
  }
}
