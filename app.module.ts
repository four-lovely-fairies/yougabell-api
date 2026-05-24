import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OnboardingCompleteGuard } from './auth/onboarding-complete.guard';
import { ChildrenModule } from './children/children.module';
import { GrowthStagesModule } from './growth-stages/growth-stages.module';
import { HomeModule } from './home/home.module';
import { MilestoneCategoriesModule } from './milestone-categories/milestone-categories.module';
import { MilestonesModule } from './milestones/milestones.module';
import { MissionsModule } from './missions/missions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { UsersModule } from './users/users.module';
import { WeeklyReportsModule } from './weekly-reports/weekly-reports.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OnboardingModule,
    UsersModule,
    AdminModule,
    HomeModule,
    NotificationsModule,
    ChildrenModule,
    WeeklyReportsModule,
    MilestoneCategoriesModule,
    MilestonesModule,
    GrowthStagesModule,
    MissionsModule,
    RoadmapModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // 모든 보호 라우트에 적용. @SkipOnboardingCheck() 핸들러는 통과한다.
      provide: APP_GUARD,
      useClass: OnboardingCompleteGuard,
    },
  ],
})
export class AppModule {}
