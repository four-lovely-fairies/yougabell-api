import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UsersController } from './users.controller';

@Module({
  imports: [OnboardingModule],
  controllers: [UsersController],
})
export class UsersModule {}
