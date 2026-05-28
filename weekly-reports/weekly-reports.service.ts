import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateText, Output } from 'ai';
import { AiConfigService } from '../ai/ai-config.service';
import {
  WEEKLY_REPORT_SYSTEM_PROMPT,
  WeeklyReportAiSchema,
  buildWeeklyReportPrompt,
  type WeeklyReportAiPayload,
} from '../ai/prompts/weekly-report';
import { getAgeLabel } from '../home/home-date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  Weekday,
  WeeklyReportCurrentResponse,
  WeeklyReportDetail,
} from './weekly-reports.types';

type AiGenerationResult = {
  payload: WeeklyReportAiPayload;
  promptTokens: number | null;
  completionTokens: number | null;
};

type GenerateTextFn = typeof generateText;

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
        userId: string;
        name: string;
        birthDate: Date;
        gender: string;
        displayOrder: number;
        createdAt: Date;
      }>
    >;
  };
  weeklyReport: {
    findFirst(args: unknown): Promise<WeeklyReportRecord | null>;
    delete(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  missionExecution: {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<unknown[]>;
  };
  mentalBatteryCheck: {
    findMany(args: unknown): Promise<Array<{ level: number }>>;
  };
  notification: {
    create(args: unknown): Promise<unknown>;
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
    private readonly aiConfig: AiConfigService,
    private readonly generateWeeklyReportText: GenerateTextFn = generateText,
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
      emptyState: report
        ? null
        : await this.getEmptyState(selectedChild.id, weekStart),
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

  async generateForWeek(input: {
    weekStart?: string;
    forceRegenerate?: boolean;
    dryRun?: boolean;
  }): Promise<{ processed: number; generated: number; skipped: number }> {
    const weekStartKey =
      input.weekStart ?? getPreviousCompletedWeekStart(new Date());
    const weekStart = parseDateOnly(weekStartKey);
    const weekEnd = addDays(weekStart, 6);
    const rangeStart = new Date(`${weekStartKey}T00:00:00+09:00`);
    const rangeEnd = new Date(`${toUtcDateOnly(weekEnd)}T23:59:59.999+09:00`);
    const children = await this.prisma.child.findMany({
      where: { deletedAt: null },
      orderBy: [{ userId: 'asc' }, { displayOrder: 'asc' }],
    });

    let generated = 0;
    let skipped = 0;

    for (const child of children) {
      const existingReport = await this.prisma.weeklyReport.findFirst({
        where: {
          childId: child.id,
          weekStart: rangeStart,
        },
      });

      if (existingReport && !input.forceRegenerate) {
        skipped += 1;
        continue;
      }

      const executions = (await this.prisma.missionExecution.findMany({
        where: {
          childId: child.id,
          status: { in: ['completed', 'early_completed'] },
          completedAt: { gte: rangeStart, lte: rangeEnd },
        },
        include: {
          mission: true,
          feedback: { include: { keywords: true } },
        },
      })) as MissionExecutionForReport[];

      if (executions.length === 0) {
        skipped += 1;
        continue;
      }

      const mentalBatteryChecks = await this.prisma.mentalBatteryCheck.findMany(
        {
          where: {
            userId: child.userId,
            checkedAt: { gte: rangeStart, lte: rangeEnd },
          },
          select: { level: true },
        },
      );

      if (input.dryRun) {
        generated += 1;
        continue;
      }

      if (existingReport && input.forceRegenerate) {
        await this.prisma.weeklyReport.delete({
          where: { id: existingReport.id },
        });
      }

      const ai = await this.generateAiSection({
        child,
        executions,
        mentalBatteryChecks,
      });

      const created = (await this.prisma.weeklyReport.create({
        data: buildWeeklyReportCreateData({
          userId: child.userId,
          childId: child.id,
          weekStart: rangeStart,
          weekEnd,
          executions,
          mentalBatteryChecks,
          ai,
        }),
      })) as { id?: string } | undefined;

      if (created?.id) {
        await this.prisma.notification.create({
          data: {
            userId: child.userId,
            childId: child.id,
            type: 'weekly_report_ready',
            title: '주간 리포트가 준비됐어요',
            body: '지난주 아이와 함께한 시간을 확인해보세요.',
            actionType: 'open_report',
            targetType: 'weekly_report',
            targetId: created.id,
            priority: 'normal',
          },
        });
      }

      generated += 1;
    }

    return {
      processed: children.length,
      generated,
      skipped,
    };
  }

  /**
   * 기획 docs/features/20260525-ai-integration.md §3.2 Phase 3 AI 필드 3개.
   * AI 설정 누락 또는 생성 실패는 리포트 생성 실패로 처리한다.
   */
  private async generateAiSection(args: {
    child: { name: string; birthDate: Date; gender: string };
    executions: MissionExecutionForReport[];
    mentalBatteryChecks: Array<{ level: number }>;
  }): Promise<AiGenerationResult> {
    const totalMissionDurationSeconds = args.executions.reduce(
      (sum, e) =>
        sum + (e.actualDurationSeconds ?? e.mission.durationMinutes * 60),
      0,
    );
    const feedbacks = args.executions
      .map((e) => e.feedback)
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    const positives = feedbacks.filter((f) => f.childReaction >= 4);
    const childPositiveReactionRate =
      feedbacks.length === 0 ? 0 : positives.length / feedbacks.length;
    const psychologicalEnergy = calculatePsychologicalEnergy({
      mentalBatteryChecks: args.mentalBatteryChecks,
      feedbacks,
    });
    const topKeywords = buildKeywordRows(args.executions).map(
      (row) => row.keyword,
    );
    const bestMomentSeeds = buildBestMomentRows(args.executions).map((row) => {
      const matched = args.executions.find(
        (e) => e.mission.title === row.title,
      );
      return {
        order: row.order,
        title: row.title,
        label: row.label,
        childReaction: matched?.feedback?.childReaction ?? null,
        childKeywords:
          matched?.feedback?.keywords.map((keyword) => keyword.keyword) ?? [],
      };
    });

    const ageMonths = monthsBetween(args.child.birthDate, new Date());

    const result = await this.generateWeeklyReportText({
      model: this.aiConfig.reportModel(),
      system: WEEKLY_REPORT_SYSTEM_PROMPT,
      prompt: buildWeeklyReportPrompt({
        child: {
          name: args.child.name,
          ageMonths,
          gender: args.child.gender,
        },
        totalMissionDurationSeconds,
        childPositiveReactionRate,
        psychologicalEnergy,
        topKeywords,
        bestMomentSeeds,
      }),
      experimental_output: Output.object({ schema: WeeklyReportAiSchema }),
    });

    return {
      payload: result.experimental_output,
      promptTokens: result.usage?.inputTokens ?? null,
      completionTokens: result.usage?.outputTokens ?? null,
    };
  }

  private async getEmptyState(
    childId: string,
    weekStartKey: string,
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

    const weekStart = parseDateOnly(weekStartKey);
    const weekEnd = addDays(weekStart, 6);
    const weeklyCompletedMissionCount =
      await this.prisma.missionExecution.count({
        where: {
          childId,
          status: { in: ['completed', 'early_completed'] },
          completedAt: {
            gte: new Date(`${weekStartKey}T00:00:00+09:00`),
            lte: new Date(`${toUtcDateOnly(weekEnd)}T23:59:59.999+09:00`),
          },
        },
      });

    if (weeklyCompletedMissionCount > 0) {
      return {
        reason: 'report_generation_pending',
        title: '리포트를 준비 중이에요',
        description: '준비가 완료되면 적당한 시간에 알림으로 알려드릴게요.',
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

type MissionExecutionForReport = {
  status: string;
  completedAt: Date;
  actualDurationSeconds: number | null;
  mission: {
    title: string;
    effect: string;
    durationMinutes: number;
  };
  feedback: null | {
    childReaction: number;
    parentEnergy: number;
    createdAt?: Date;
    keywords: Array<{
      keyword: string;
      rank?: number;
    }>;
  };
};

function buildWeeklyReportCreateData({
  userId,
  childId,
  weekStart,
  weekEnd,
  executions,
  mentalBatteryChecks,
  ai,
}: {
  userId: string;
  childId: string;
  weekStart: Date;
  weekEnd: Date;
  executions: MissionExecutionForReport[];
  mentalBatteryChecks: Array<{ level: number }>;
  ai: AiGenerationResult;
}) {
  const totalMissionDurationSeconds = executions.reduce(
    (sum, execution) =>
      sum +
      (execution.actualDurationSeconds ??
        execution.mission.durationMinutes * 60),
    0,
  );
  const feedbacks = executions
    .map((execution) => execution.feedback)
    .filter((feedback): feedback is NonNullable<typeof feedback> =>
      Boolean(feedback),
    );
  const positiveFeedbacks = feedbacks.filter(
    (feedback) => feedback.childReaction >= 4,
  );
  const childPositiveReactionRate =
    feedbacks.length === 0 ? 0 : positiveFeedbacks.length / feedbacks.length;
  const psychologicalEnergy = calculatePsychologicalEnergy({
    mentalBatteryChecks,
    feedbacks,
  });

  const baseBestMoments = buildBestMomentRows(executions);
  const aiBestMomentByOrder = new Map(
    ai.payload.bestMomentBodies.map((m) => [m.order, m.body]),
  );
  const mergedBestMoments = baseBestMoments.map((row) => ({
    ...row,
    body: aiBestMomentByOrder.get(row.order) ?? row.body,
  }));

  return {
    userId,
    childId,
    weekStart,
    weekEnd,
    headline: '이번 주도 아이와의 시간을 잘 쌓아가고 있어요.',
    headlineBody: ai.payload.headlineBody,
    totalMissionDurationSeconds,
    childPositiveReactionRate,
    psychologicalEnergy,
    aiActionSuggestion: ai.payload.aiActionSuggestion,
    aiGeneratedAt: new Date(),
    aiPromptTokens: ai.promptTokens,
    aiCompletionTokens: ai.completionTokens,
    generatedAt: new Date(),
    days: { create: buildDayRows(executions) },
    topKeywords: { create: buildKeywordRows(executions) },
    bestMoments: { create: mergedBestMoments },
  };
}

function monthsBetween(birthDate: Date, today: Date): number {
  const years = today.getFullYear() - birthDate.getFullYear();
  const months = today.getMonth() - birthDate.getMonth();
  return Math.max(0, years * 12 + months);
}

function buildDayRows(executions: MissionExecutionForReport[]) {
  const counts = new Map<Weekday, number>();
  for (const execution of executions) {
    const weekday = getWeekday(execution.completedAt);
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }

  return WEEKDAYS.map((weekday) => ({
    weekday,
    completedCount: counts.get(weekday) ?? 0,
  }));
}

function calculatePsychologicalEnergy({
  mentalBatteryChecks,
  feedbacks,
}: {
  mentalBatteryChecks: Array<{ level: number }>;
  feedbacks: Array<{ parentEnergy: number }>;
}): number {
  if (mentalBatteryChecks.length > 0) {
    return scaleFivePointAverageToPercent(
      mentalBatteryChecks.map((check) => check.level),
    );
  }

  if (feedbacks.length > 0) {
    return scaleFivePointAverageToPercent(
      feedbacks.map((feedback) => feedback.parentEnergy),
    );
  }

  return 50;
}

function scaleFivePointAverageToPercent(values: number[]): number {
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length / 5) * 100,
  );
}

function buildBestMomentRows(executions: MissionExecutionForReport[]) {
  const executionsWithFeedback = executions.filter(
    (
      execution,
    ): execution is MissionExecutionForReport & {
      feedback: NonNullable<MissionExecutionForReport['feedback']>;
    } => Boolean(execution.feedback),
  );

  if (executionsWithFeedback.length === 0) {
    return [];
  }

  const highestReaction = Math.max(
    ...executionsWithFeedback.map(
      (execution) => execution.feedback.childReaction,
    ),
  );

  return executionsWithFeedback
    .filter((execution) => execution.feedback.childReaction === highestReaction)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
    .map((execution, index) => ({
      order: index + 1,
      label: `아이 반응 ${highestReaction}점`,
      title: execution.mission.title,
      body: execution.mission.effect,
    }));
}

function buildKeywordRows(executions: MissionExecutionForReport[]) {
  const stats = new Map<
    string,
    {
      keyword: string;
      count: number;
      firstSeenAt: number;
      firstRank: number;
    }
  >();

  for (const execution of executions) {
    for (const keyword of execution.feedback?.keywords ?? []) {
      const displayKeyword = normalizeKeywordDisplay(keyword.keyword);
      if (!displayKeyword) continue;

      const compareKey = normalizeKeywordCompare(displayKeyword);
      const seenAt =
        execution.feedback?.createdAt?.getTime() ??
        execution.completedAt.getTime();
      const rank = keyword.rank ?? Number.MAX_SAFE_INTEGER;
      const current = stats.get(compareKey);
      if (current) {
        current.count += 1;
        current.firstSeenAt = Math.min(current.firstSeenAt, seenAt);
        current.firstRank = Math.min(current.firstRank, rank);
      } else {
        stats.set(compareKey, {
          keyword: displayKeyword,
          count: 1,
          firstSeenAt: seenAt,
          firstRank: rank,
        });
      }
    }
  }

  return [...stats.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.firstSeenAt - b.firstSeenAt ||
        a.firstRank - b.firstRank ||
        a.keyword.localeCompare(b.keyword),
    )
    .slice(0, 3)
    .map((entry, index) => ({
      rank: index + 1,
      keyword: entry.keyword,
    }));
}

function normalizeKeywordDisplay(keyword: string): string {
  return keyword.trim().replace(/\s+/g, ' ');
}

function normalizeKeywordCompare(keyword: string): string {
  return keyword.replace(/[A-Za-z]+/g, (letters) => letters.toLowerCase());
}

function getWeekday(date: Date): Weekday {
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = seoul.getUTCDay();
  return WEEKDAYS[day === 0 ? 6 : day - 1];
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

function parseDateOnly(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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
