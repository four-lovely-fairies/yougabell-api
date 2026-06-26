import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { generateText, Output } from 'ai';
import { AiConfigService } from '../../ai/ai-config.service';
import {
  WEEKLY_REPORT_SYSTEM_PROMPT,
  WeeklyReportAiSchema,
  buildWeeklyReportPrompt,
} from '../../ai/prompts/weekly-report';
import { getAgeLabel } from '../../home/home-date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WeeklyReportCurrentResponse,
  WeeklyReportDetail,
} from '../weekly-reports.types';
import {
  buildBestMomentRows,
  buildKeywordRows,
  buildWeeklyReportCreateData,
  calculatePsychologicalEnergy,
  monthsBetween,
} from './aggregate';
import {
  addDays,
  getPreviousCompletedWeekStart,
  parseDateOnly,
  toUtcDateOnly,
} from './date.utils';
import type {
  AiGenerationResult,
  MissionExecutionForReport,
  WeeklyReportsPrisma,
} from './records';
import { toDetail } from './presenter';

type GenerateTextFn = typeof generateText;

export const WEEKLY_REPORT_GENERATE_TEXT = 'WEEKLY_REPORT_GENERATE_TEXT';

@Injectable()
export class WeeklyReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: WeeklyReportsPrisma,
    private readonly aiConfig: AiConfigService,
    @Optional()
    @Inject(WEEKLY_REPORT_GENERATE_TEXT)
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

      await this.prisma.weeklyReport.create({
        data: buildWeeklyReportCreateData({
          userId: child.userId,
          childId: child.id,
          weekStart: rangeStart,
          weekEnd,
          executions,
          mentalBatteryChecks,
          ai,
        }),
      });

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
          '놀이를 수행하고 아이와의 소중한 순간을 기록해보세요. 일주일 후 첫 리포트를 확인할 수 있습니다.',
        ctaLabel: '놀이 시작하기',
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
        ctaLabel: '놀이 시작하기',
        ctaHref: '/mission',
      };
    }

    return {
      reason: 'no_mission_for_week',
      title: '아직 주간 리포트가 없습니다',
      description:
        '지난주에는 리포트로 만들 기록이 없었어요. 이번 주 놀이를 시작해보세요.',
      ctaLabel: '놀이 시작하기',
      ctaHref: '/mission',
    };
  }
}
