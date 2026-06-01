import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipOnboardingCheck } from './auth/skip-onboarding-check.decorator';

@SkipOnboardingCheck()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /health — 인증 불필요(@SkipOnboardingCheck로 JWT까지 통과). 웜업·헬스체크 대상.
  @Get('health')
  getHealth(): { status: 'ok'; timestamp: string } {
    return this.appService.getHealth();
  }
}
