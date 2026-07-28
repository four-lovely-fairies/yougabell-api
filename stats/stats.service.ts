import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import {
  fetchActiveDays,
  fetchDaily,
  fetchHourly,
  fetchWeekday,
} from './queries/engagement.queries';
import {
  fetchCategoryDistribution,
  fetchFeedbackSummary,
  fetchMissionStatus,
  fetchTopKeywords,
  fetchTopMissions,
} from './queries/mission.queries';
import {
  countCareExecutions,
  fetchMoodDaily,
  fetchMoodLevels,
} from './queries/mood.queries';
import type { EngagementStats } from './stats.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 주어진 시각이 속한 KST 하루의 시작(00:00 KST)을 UTC Date로 돌려준다. */
function kstDayStart(at: Date): Date {
  const shifted = new Date(at.getTime() + KST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - KST_OFFSET_MS);
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 운영자 대시보드용 참여도 통계.
   *
   * 접속 로그 테이블이 없어 "오늘의 놀이 · 오늘의 기분 · 마음 케어 · 챗" 기록을
   * 접속 프록시로 사용한다. 자세한 정의는 `stats.types.ts` 참고.
   */
  async engagement(query: StatsQueryDto): Promise<EngagementStats> {
    const days = query.days ?? 30;
    // 오늘(KST) 포함 최근 N일 → [from, to) 반열린 구간
    const to = new Date(kstDayStart(new Date()).getTime() + DAY_MS);
    const from = new Date(to.getTime() - days * DAY_MS);

    const [
      daily,
      activeDays,
      weekday,
      hourly,
      moodLevels,
      moodDaily,
      missionStatus,
      topMissions,
      categories,
      feedback,
      keywords,
      users,
      children,
      newUsers,
      missionExecutions,
      missionCompleted,
      careExecutions,
      chatMessages,
    ] = await Promise.all([
      fetchDaily(this.prisma, from, to),
      fetchActiveDays(this.prisma, from, to),
      fetchWeekday(this.prisma, from, to),
      fetchHourly(this.prisma, from, to),
      fetchMoodLevels(this.prisma, from, to),
      fetchMoodDaily(this.prisma, from, to),
      fetchMissionStatus(this.prisma, from, to),
      fetchTopMissions(this.prisma, from, to),
      fetchCategoryDistribution(this.prisma, from, to),
      fetchFeedbackSummary(this.prisma, from, to),
      fetchTopKeywords(this.prisma, from, to),
      this.prisma.user.count({
        where: { deletedAt: null, onboardedAt: { not: null } },
      }),
      this.prisma.child.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: from, lt: to } } }),
      this.prisma.missionExecution.count({
        where: { startedAt: { gte: from, lt: to } },
      }),
      this.prisma.missionExecution.count({
        where: {
          startedAt: { gte: from, lt: to },
          status: { in: ['completed', 'early_completed'] },
        },
      }),
      countCareExecutions(this.prisma, from, to),
      this.prisma.chatMessage.count({
        where: { role: 'user', sentAt: { gte: from, lt: to } },
      }),
    ]);

    const moodChecks = moodLevels.reduce((acc, m) => acc + m.count, 0);
    const moodSum = moodLevels.reduce((acc, m) => acc + m.level * m.count, 0);

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        days,
        timezone: 'Asia/Seoul',
      },
      totals: {
        users,
        children,
        newUsers,
        activeUsers: activeDays.activeUsers,
        returningUsers: activeDays.returningUsers,
        returningRate:
          activeDays.activeUsers === 0
            ? 0
            : activeDays.returningUsers / activeDays.activeUsers,
        avgActiveDays: activeDays.avgActiveDays,
        missionExecutions,
        missionCompleted,
        missionCompletionRate:
          missionExecutions === 0 ? 0 : missionCompleted / missionExecutions,
        moodChecks,
        avgMoodLevel: moodChecks === 0 ? null : moodSum / moodChecks,
        careExecutions,
        chatMessages,
      },
      daily,
      activeDays: activeDays.buckets,
      weekday,
      hourly,
      moodLevels,
      moodDaily,
      missionStatus,
      topMissions,
      categories,
      feedback,
      keywords,
    };
  }
}
