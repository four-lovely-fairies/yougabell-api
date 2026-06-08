import { Weekday } from '../weekly-reports.types';
import { getWeekday, WEEKDAYS } from './date.utils';
import { AiGenerationResult, MissionExecutionForReport } from './records';

export function buildWeeklyReportCreateData({
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

export function monthsBetween(birthDate: Date, today: Date): number {
  const years = today.getFullYear() - birthDate.getFullYear();
  const months = today.getMonth() - birthDate.getMonth();
  return Math.max(0, years * 12 + months);
}

export function calculatePsychologicalEnergy({
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

export function buildBestMomentRows(executions: MissionExecutionForReport[]) {
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

export function buildKeywordRows(executions: MissionExecutionForReport[]) {
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

function scaleFivePointAverageToPercent(values: number[]): number {
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length / 5) * 100,
  );
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

function normalizeKeywordDisplay(keyword: string): string {
  return keyword.trim().replace(/\s+/g, ' ');
}

function normalizeKeywordCompare(keyword: string): string {
  return keyword.replace(/[A-Za-z]+/g, (letters) => letters.toLowerCase());
}
