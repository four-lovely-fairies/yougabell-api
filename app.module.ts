import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OnboardingCompleteGuard } from './auth/onboarding-complete.guard';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OnboardingModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // 모든 보호 라우트에 적용 (각 컨트롤러는 JwtAuthGuard로 인증 후 본 가드가 onboardedAt 검사)
      provide: APP_GUARD,
      useClass: OnboardingCompleteGuard,
    },
  ],
})
export class AppModule {}
