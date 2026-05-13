import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipOnboardingCheck } from '../auth/skip-onboarding-check.decorator';
import { AdminService } from './admin.service';
import { GenerateWeeklyReportsDto } from './dto/generate-weekly-reports.dto';
import { ListUsersDto } from './dto/list-users.dto';

/**
 * 운영자(admin) 전용 라우트.
 *
 * TODO(auth): `AdminRoleGuard` 추가 — Supabase `auth.users.app_metadata.role === 'admin'` 검증.
 * 현재는 `JwtAuthGuard` placeholder만 적용 (누구나 접근 가능, 별도 task에서 잠금).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard)
@SkipOnboardingCheck()
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  @ApiOperation({
    summary: '사용자 목록 (운영자)',
    description:
      '온보딩 완료자 기본. q(이름 LIKE) / page / limit / onboarded 필터.',
  })
  async listUsers(@Query() query: ListUsersDto) {
    return this.service.listUsers(query);
  }

  @Post('weekly-reports/generate')
  @ApiOperation({
    summary: '주간 리포트 수동 생성 (운영자)',
    description:
      '지정한 주차 또는 직전 완료 주차의 주간 리포트를 자녀별로 생성한다.',
  })
  async generateWeeklyReports(@Body() body: GenerateWeeklyReportsDto) {
    return this.service.generateWeeklyReports(body);
  }
}
