import { Inject, Injectable } from '@nestjs/common';
import { NotificationPreferenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getPreviousCompletedWeekStart,
  toDateOnly,
} from '../home/home-date.utils';

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const PLAY_REMINDER_DEFAULT_TIME = '19:00';
const WEEKLY_REPORT_DEFAULT_TIME = '12:00';

type DispatchInput = {
  now?: string;
  dryRun?: boolean;
};

type DispatchResult = {
  processed: number;
  generated: number;
  skipped: number;
};

type DispatchPrisma = Pick<
  PrismaService,
  'notificationPreference' | 'notification' | 'weeklyReport'
>;

@Injectable()
export class NotificationDispatchService {
  constructor(@Inject(PrismaService) private readonly prisma: DispatchPrisma) {}

  async dispatchPlayReminders(input: DispatchInput): Promise<DispatchResult> {
    const now = resolveNow(input.now);
    const currentTime = toSeoulTime(now);
    const dayRange = getSeoulDayRange(now);
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        type: 'play_10min',
        enabled: true,
        time: currentTime,
        user: {
          deletedAt: null,
          onboardedAt: { not: null },
        },
      },
      include: {
        user: {
          select: {
            children: {
              where: { deletedAt: null },
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    let generated = 0;
    let skipped = 0;

    for (const preference of preferences) {
      const child = preference.user.children[0];
      if (!child) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: preference.userId,
          type: 'mission_reminder',
          createdAt: {
            gte: dayRange.start,
            lt: dayRange.end,
          },
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      if (!input.dryRun) {
        await this.prisma.notification.create({
          data: {
            userId: preference.userId,
            childId: child.id,
            type: 'mission_reminder',
            title: '10분 놀이 시간이에요',
            body: `${child.name}와 오늘의 10분 놀이를 시작해보세요.`,
            actionType: 'open_mission',
            targetType: 'child',
            targetId: child.id,
            priority: 'normal',
          },
        });
      }

      generated += 1;
    }

    return { processed: preferences.length, generated, skipped };
  }

  async dispatchWeeklyReportNotifications(
    input: DispatchInput,
  ): Promise<DispatchResult> {
    const now = resolveNow(input.now);
    if (!isSeoulMonday(now)) {
      return { processed: 0, generated: 0, skipped: 0 };
    }

    const currentTime = toSeoulTime(now);
    const weekStart = toDateOnly(getPreviousCompletedWeekStart(now));
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        type: 'weekly_report',
        enabled: true,
        time: currentTime,
        user: {
          deletedAt: null,
          onboardedAt: { not: null },
        },
      },
      select: { userId: true },
    });

    let processed = 0;
    let generated = 0;
    let skipped = 0;

    for (const preference of preferences) {
      const reports = await this.prisma.weeklyReport.findMany({
        where: {
          userId: preference.userId,
          weekStart: new Date(`${weekStart}T00:00:00+09:00`),
          child: { deletedAt: null },
        },
        select: {
          id: true,
          childId: true,
        },
      });

      for (const report of reports) {
        processed += 1;
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: preference.userId,
            type: 'weekly_report_ready',
            targetId: report.id,
          },
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        if (!input.dryRun) {
          await this.prisma.notification.create({
            data: {
              userId: preference.userId,
              childId: report.childId,
              type: 'weekly_report_ready',
              title: '주간 리포트가 준비됐어요',
              body: '지난주 아이와 함께한 시간을 확인해보세요.',
              actionType: 'open_report',
              targetType: 'weekly_report',
              targetId: report.id,
              priority: 'normal',
            },
          });
        }

        generated += 1;
      }
    }

    return { processed, generated, skipped };
  }
}

export function defaultNotificationTime(
  type: NotificationPreferenceType,
): string {
  return type === 'weekly_report'
    ? WEEKLY_REPORT_DEFAULT_TIME
    : PLAY_REMINDER_DEFAULT_TIME;
}

function resolveNow(now?: string): Date {
  return now ? new Date(now) : new Date();
}

function toSeoulTime(date: Date): string {
  const seoulDate = new Date(date.getTime() + SEOUL_OFFSET_MS);
  const hours = String(seoulDate.getUTCHours()).padStart(2, '0');
  const minutes = String(seoulDate.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getSeoulDayRange(date: Date) {
  const seoulDate = new Date(date.getTime() + SEOUL_OFFSET_MS);
  const start = new Date(
    Date.UTC(
      seoulDate.getUTCFullYear(),
      seoulDate.getUTCMonth(),
      seoulDate.getUTCDate(),
      -9,
      0,
      0,
      0,
    ),
  );

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

function isSeoulMonday(date: Date) {
  const seoulDate = new Date(date.getTime() + SEOUL_OFFSET_MS);
  return seoulDate.getUTCDay() === 1;
}
