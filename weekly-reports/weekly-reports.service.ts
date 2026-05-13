import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getAgeLabel } from '../home/home-date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  Weekday,
  WeeklyReportCurrentResponse,
  WeeklyReportDetail,
} from './weekly-reports.types';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_LABELS: Record<
  Weekday,
  '월' | '화' | '수' | '목' | '금' | '토' | '일'
> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

export type WeeklyReportsPrisma = {
  child: {
    findMany(args: unknown): Promise<
      Array<{
        id: string;
        name: string;
        birthDate: Date;
        displayOrder: number;
        createdAt: Date;
      }>
    >;
  };
  weeklyReport: {
    findFirst(args: unknown): Promise<WeeklyReportRecord | null>;
  };
  missionExecution: {
    count(args: unknown): Promise<number>;
  };
};

type WeeklyReportRecord = {
  id: string;
  userId?: string;
  childId?: string;
  weekStart: Date;
  weekEnd: Date;
  headline: string;
  headlineBody: string | null;
  totalMissionDurationSeconds: number;
  childPositiveReactionRate: number;
  psychologicalEnergy: number;
  aiActionSuggestion: string;
  generatedAt: Date;
  days: Array<{
    weekday: Weekday;
    completedCount: number;
  }>;
  topKeywords: Array<{
    rank: number;
    keyword: string;
  }>;
  bestMoments: Array<{
    id: string;
    order: number;
    label: string | null;
    title: string;
    body: string;
  }>;
  improvementTips?: unknown[];
};

@Injectable()
export class WeeklyReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: WeeklyReportsPrisma,
  ) {}

  async getCurrent(
    userId: string,
    query: { childId?: string; weekStart?: string; today?: Date },
  ): Promise<WeeklyReportCurrentResponse> {
    const today = query.today ?? new Date();
    const weekStart = query.weekStart ?? getPreviousCompletedWeekStart(today);
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

    const report = await this.prisma.weeklyReport.findFirst({
      where: {
        userId,
        childId: selectedChild.id,
        weekStart: new Date(`${weekStart}T00:00:00+09:00`),
      },
      include: {
        days: true,
        topKeywords: true,
        bestMoments: true,
        improvementTips: { include: { tip: true } },
      },
    });

    return {
      selectedChild: {
        id: selectedChild.id,
        name: selectedChild.name,
        ageLabel: getAgeLabel(selectedChild.birthDate, today),
      },
      report: report ? toDetail(report) : null,
      emptyState: report ? null : await this.getEmptyState(selectedChild.id),
    };
  }

  async getById(userId: string, reportId: string): Promise<WeeklyReportDetail> {
    const report = await this.prisma.weeklyReport.findFirst({
      where: {
        id: reportId,
        userId,
        child: { deletedAt: null },
      },
      include: {
        days: true,
        topKeywords: true,
        bestMoments: true,
        improvementTips: { include: { tip: true } },
      },
    });

    if (!report) {
      throw new NotFoundException({
        code: 'WEEKLY_REPORT_NOT_FOUND',
        message: 'Weekly report not found.',
      });
    }

    return toDetail(report);
  }

  private async getEmptyState(
    childId: string,
  ): Promise<WeeklyReportCurrentResponse['emptyState']> {
    const completedMissionCount = await this.prisma.missionExecution.count({
      where: {
        childId,
        status: { in: ['completed', 'early_completed'] },
      },
    });

    if (completedMissionCount === 0) {
      return {
        reason: 'no_mission_yet',
        title: '아직 주간 리포트가 없습니다',
        description:
          '미션을 수행하고 아이와의 소중한 순간을 기록해보세요. 일주일 후 첫 리포트를 확인할 수 있습니다.',
        ctaLabel: '미션 시작하기',
        ctaHref: '/mission',
      };
    }

    return {
      reason: 'no_mission_for_week',
      title: '아직 주간 리포트가 없습니다',
      description:
        '지난주에는 리포트로 만들 기록이 없었어요. 이번 주 미션을 시작해보세요.',
      ctaLabel: '미션 시작하기',
      ctaHref: '/mission',
    };
  }
}

function toDetail(report: WeeklyReportRecord): WeeklyReportDetail {
  const topKeywords = report.topKeywords
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((keyword) => ({
      rank: keyword.rank as 1 | 2 | 3,
      keyword: keyword.keyword,
    }));

  return {
    id: report.id,
    weekStart: toSeoulDateKey(report.weekStart),
    weekEnd: toSeoulDateKey(report.weekEnd),
    generatedAt: report.generatedAt.toISOString(),
    headline: {
      question: '나는 잘하고 있는가?',
      title: report.headline,
      body: report.headlineBody,
    },
    missionSummary: {
      days: buildDays(report.days),
      totalDurationSeconds: report.totalMissionDurationSeconds,
      totalDurationLabel: formatDuration(report.totalMissionDurationSeconds),
      childPositiveReactionRate: Math.round(
        report.childPositiveReactionRate * 100,
      ),
    },
    topKeywords,
    keywordEmptyState:
      topKeywords.length > 0
        ? null
        : {
            title: '아직 키워드가 충분하지 않아요',
            description:
              '미션 후 피드백에서 아이가 자주 말한 단어를 남겨보세요. 다음 리포트에서 아이의 관심사가 더 선명하게 보여요.',
          },
    bestMoments: report.bestMoments
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((moment) => ({
        id: moment.id,
        order: moment.order,
        ...(moment.label ? { label: moment.label } : {}),
        title: moment.title,
        body: moment.body,
      })),
    innerState: {
      psychologicalEnergy: report.psychologicalEnergy,
      tipTitle: '기분 전환을 위한 팁',
    },
    aiActionSuggestion: {
      title: '미래 행동 제안 (AI 기반)',
      body: report.aiActionSuggestion,
    },
  };
}

function buildDays(days: WeeklyReportRecord['days']) {
  const countByWeekday = new Map(
    days.map((day) => [day.weekday, day.completedCount]),
  );

  return WEEKDAYS.map((weekday) => {
    const completedCount = countByWeekday.get(weekday) ?? 0;
    return {
      weekday,
      label: WEEKDAY_LABELS[weekday],
      completedCount,
      completed: completedCount > 0,
    };
  });
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }
  if (minutes === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${minutes}분`;
}

function getPreviousCompletedWeekStart(today: Date): string {
  const seoul = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const currentSeoulDate = new Date(
    Date.UTC(seoul.getUTCFullYear(), seoul.getUTCMonth(), seoul.getUTCDate()),
  );
  const dayOfWeek = currentSeoulDate.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentSeoulDate.setUTCDate(
    currentSeoulDate.getUTCDate() - daysFromMonday - 7,
  );
  return toUtcDateOnly(currentSeoulDate);
}

function toSeoulDateKey(date: Date): string {
  return toUtcDateOnly(new Date(date.getTime() + 9 * 60 * 60 * 1000));
}

function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
