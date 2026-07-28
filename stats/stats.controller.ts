import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { StatsQueryDto } from './dto/stats-query.dto';
import { StatsService } from './stats.service';

@ApiTags('admin/stats')
@ApiBearerAuth()
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@SkipOnboardingCheck()
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('engagement')
  @ApiOperation({
    summary: '참여도 통계 (운영자)',
    description:
      '접속 로그 테이블이 없어 오늘의 놀이 · 오늘의 기분 · 마음 케어 · 챗 기록을 ' +
      '접속 프록시로 집계한다. KST 기준 최근 N일(default 30).',
  })
  engagement(@Query() query: StatsQueryDto) {
    return this.service.engagement(query);
  }
}
