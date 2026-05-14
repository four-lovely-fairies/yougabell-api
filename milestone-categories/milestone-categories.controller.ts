import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { MilestoneCategoryResponseDto } from './dto/milestone-category.dto';
import { MilestoneCategoriesService } from './milestone-categories.service';

// TODO(auth): AdminGuard 도입 후 @UseGuards 복원. 현재는 dev only 무가드.
@ApiTags('admin/categories')
@Controller('admin/categories')
@SkipOnboardingCheck()
export class MilestoneCategoriesController {
  constructor(private readonly service: MilestoneCategoriesService) {}

  @Get()
  @ApiOkResponse({ type: MilestoneCategoryResponseDto, isArray: true })
  list(): Promise<MilestoneCategoryResponseDto[]> {
    return this.service.list();
  }
}
