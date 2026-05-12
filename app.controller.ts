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
}
