import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MissionExecutionStatus, Prisma } from '@prisma/client';
import { findCurrentMission } from '../missions/missions.service/recommendation';
import { milestoneAgeWhere } from '../milestones/milestone-age';
import { PrismaService } from '../prisma/prisma.service';
import {
  ROADMAP_CATEGORY_ORDER,
  resolveRoadmapCheckpoint,
} from '../roadmap/roadmap.types';
import {
  formatDurationLabel,
  getAgeLabel,
  getAgeMonths,
  getPreviousCompletedWeekStart,
  getPlayStreakDays,
  getWeekInfo,
  toDateOnly,
  toSeoulDateKey,
} from './home-date.utils';
import {
  HomeChild,
  HomeDashboard,
  HomeMoodCheck,
  HomeNotificationSummaryItem,
} from './home.types';

const COMPLETED_MISSION_STATUSES: MissionExecutionStatus[] = [
  'completed',
  'early_completed',
];

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(
    userId: string,
    query: { childId?: string; date?: string },
  ): Promise<HomeDashboard> {
    const today = parseHomeDate(query.date);
    const children = await this.prisma.child.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (children.length === 0) {
      throw new ConflictException({
        code: 'NO_CHILD_PROFILE',
        message: 'No active child profile exists.',
      });
    }

    const selectedChild = query.childId
      ? children.find((child) => child.id === query.childId)
      : children[0];

    if (!selectedChild) {
      throw new NotFoundException({
        code: 'CHILD_NOT_FOUND',
        message: 'Child not found.',
      });
    }

    const ageMonths = getAgeMonths(selectedChild.birthDate, today);
    const weekInfo = getWeekInfo(today);
    const weekStart = new Date(`${weekInfo.days[0]?.date}T00:00:00+09:00`);
    const weekEnd = new Date(`${weekInfo.days[6]?.date}T23:59:59.999+09:00`);
    const previousWeekStartKey = toDateOnly(
      getPreviousCompletedWeekStart(today),
    );
    const previousWeekStart = new Date(
      `${previousWeekStartKey}T00:00:00+09:00`,
    );

    const [
      batteryChecks,
      weeklyExecutions,
      completedExecutions,
      latestWeeklyReport,
      growthStage,
      recommendedMission,
      unreadCount,
      latestNotifications,
      roadmapProgress,
    ] = await Promise.all([
      this.prisma.mentalBatteryCheck.findMany({
        where: {
          userId,
          checkedAt: { gte: weekStart, lte: weekEnd },
        },
        orderBy: { checkedAt: 'desc' },
      }),
      this.prisma.missionExecution.findMany({
        where: {
          childId: selectedChild.id,
          startedAt: { gte: weekStart, lte: weekEnd },
        },
      }),
      this.prisma.missionExecution.findMany({
        where: {
          childId: selectedChild.id,
          status: { in: COMPLETED_MISSION_STATUSES },
        },
        select: {
          startedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.weeklyReport.findFirst({
        where: {
          childId: selectedChild.id,
          weekStart: previousWeekStart,
        },
        include: { days: true },
      }),
      this.prisma.growthStage.findFirst({
        where: {
          ageMonthsFrom: { lte: ageMonths },
          ageMonthsTo: { gte: ageMonths },
        },
        orderBy: { ageMonthsFrom: 'desc' },
      }),
      this.findRecommendedMission(selectedChild.id, ageMonths, today),
      this.prisma.notification.count({
        where: this.activeNotificationWhere(userId, true),
      }),
      this.prisma.notification.findMany({
        where: this.activeNotificationWhere(userId, false),
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.getRoadmapProgress(selectedChild.id, ageMonths),
    ]);

    const moodByDate = new Map<string, (typeof batteryChecks)[number]>();
    for (const check of batteryChecks) {
      const key = toSeoulDateKey(check.checkedAt);
      if (!moodByDate.has(key)) {
        moodByDate.set(key, check);
      }
    }

    const completedMissionDates = new Set(
      weeklyExecutions
        .filter((execution) =>
          COMPLETED_MISSION_STATUSES.includes(execution.status),
        )
        .map((execution) =>
          toSeoulDateKey(execution.completedAt ?? execution.startedAt),
        ),
    );

    return {
      selectedChild: toHomeChild(selectedChild, today),
      children: children.map((child) => toHomeChild(child, today)),
      week: {
        monthLabel: weekInfo.monthLabel,
        weekOfMonthLabel: weekInfo.weekOfMonthLabel,
        days: weekInfo.days.map((day) => {
          const mood = moodByDate.get(day.date);
          return {
            ...day,
            mood: mood
              ? {
                  level: mood.level as 1 | 2 | 3 | 4 | 5,
                  emoji: moodEmoji(mood.level),
                }
              : undefined,
            missionCompleted: completedMissionDates.has(day.date),
          };
        }),
      },
      playStreakDays: getPlayStreakDays(completedExecutions, today),
      recommendedMission,
      growthStage: growthStage
        ? {
            id: growthStage.id,
            name: growthStage.name,
            summary: growthStage.summary,
          }
        : null,
      roadmapProgress,
      reportSummary: latestWeeklyReport
        ? {
            reportId: latestWeeklyReport.id,
            weekStart: toDateOnly(latestWeeklyReport.weekStart),
            weekEnd: toDateOnly(latestWeeklyReport.weekEnd),
            title: '지난주 아이와 함께한 놀이 시간',
            completedPlayCount: latestWeeklyReport.days.reduce(
              (total, day) => total + day.completedCount,
              0,
            ),
            totalDurationSeconds:
              latestWeeklyReport.totalMissionDurationSeconds,
            totalDurationLabel: formatDurationLabel(
              latestWeeklyReport.totalMissionDurationSeconds,
            ),
            childPositiveReactionRate: Math.round(
              latestWeeklyReport.childPositiveReactionRate * 100,
            ),
          }
        : null,
      notifications: {
        unreadCount,
        latest: latestNotifications.map(toHomeNotification),
      },
    };
  }

  async upsertTodayMood(
    userId: string,
    level: 1 | 2 | 3 | 4 | 5,
  ): Promise<HomeMoodCheck> {
    const now = new Date();
    const todayKey = toSeoulDateKey(now);
    const todayStart = new Date(`${todayKey}T00:00:00+09:00`);
    const todayEnd = new Date(`${todayKey}T23:59:59.999+09:00`);

    const existing = await this.prisma.mentalBatteryCheck.findFirst({
      where: {
        userId,
        checkedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      orderBy: { checkedAt: 'desc' },
    });

    const saved = existing
      ? await this.prisma.mentalBatteryCheck.update({
          where: { id: existing.id },
          data: {
            level,
            checkedAt: now,
          },
        })
      : await this.prisma.mentalBatteryCheck.create({
          data: {
            userId,
            level,
            checkedAt: now,
          },
        });

    return {
      level: saved.level as 1 | 2 | 3 | 4 | 5,
      emoji: moodEmoji(saved.level),
      checkedAt: saved.checkedAt.toISOString(),
    };
  }

  private activeNotificationWhere(
    userId: string,
    unreadOnly: boolean,
  ): Prisma.NotificationWhereInput {
    return {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
  }

  private async findRecommendedMission(
    childId: string,
    ageMonths: number,
    today: Date,
  ): Promise<HomeDashboard['recommendedMission']> {
    const currentMission = await findCurrentMission(
      this.prisma,
      childId,
      ageMonths,
      today,
    );

    if (!currentMission) {
      return null;
    }

    return {
      id: currentMission.mission.id,
      subThemeLabel:
        currentMission.mission.subThemeLabel ??
        currentMission.mission.category.label,
      title: currentMission.mission.title,
      durationMinutes: currentMission.mission.durationMinutes,
      status: currentMission.status,
    };
  }

  private async getRoadmapProgress(
    childId: string,
    ageMonths: number,
  ): Promise<HomeDashboard['roadmapProgress']> {
    const targetMonth = resolveRoadmapCheckpoint(ageMonths);
    const milestones = await this.prisma.milestone.findMany({
      where: {
        ...milestoneAgeWhere(targetMonth),
        categoryId: { in: ROADMAP_CATEGORY_ORDER },
      },
      select: { id: true },
    });
    const milestoneIds = milestones.map((milestone) => milestone.id);
    const completedCount =
      milestoneIds.length === 0
        ? 0
        : await this.prisma.childMilestoneCompletion.count({
            where: { childId, milestoneId: { in: milestoneIds } },
          });

    return {
      targetMonth,
      completedCount,
      totalCount: milestoneIds.length,
    };
  }
}

function parseHomeDate(date?: string): Date {
  if (!date) {
    return new Date();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'date must be YYYY-MM-DD.',
    });
  }
  const parsed = new Date(`${date}T12:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'date is invalid.',
    });
  }
  return parsed;
}

function toHomeChild(
  child: { id: string; name: string; birthDate: Date; displayOrder: number },
  today: Date,
): HomeChild {
  return {
    id: child.id,
    name: child.name,
    birthDate: toDateOnly(child.birthDate),
    ageLabel: getAgeLabel(child.birthDate, today),
    displayOrder: child.displayOrder,
  };
}

function toHomeNotification(notification: {
  id: string;
  title: string;
  body: string;
  actionType: HomeNotificationSummaryItem['actionType'];
  targetType: HomeNotificationSummaryItem['targetType'];
  targetId: string | null;
  targetUrl: string | null;
  createdAt: Date;
  readAt: Date | null;
}): HomeNotificationSummaryItem {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    actionType: notification.actionType,
    targetType: notification.targetType,
    targetId: notification.targetId,
    targetUrl: notification.targetUrl,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}

function moodEmoji(level: number): string {
  switch (level) {
    case 1:
      return '😫';
    case 2:
      return '😕';
    case 3:
      return '🙂';
    case 4:
      return '😊';
    case 5:
      return '🥰';
    default:
      return '🙂';
  }
}
