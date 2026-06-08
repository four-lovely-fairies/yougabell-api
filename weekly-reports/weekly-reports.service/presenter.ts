import { Weekday, WeeklyReportDetail } from '../weekly-reports.types';
import { toSeoulDateKey, WEEKDAYS } from './date.utils';
import { WeeklyReportRecord } from './records';

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

export function toDetail(report: WeeklyReportRecord): WeeklyReportDetail {
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
