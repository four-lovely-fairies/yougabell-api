import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [OnboardingModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
