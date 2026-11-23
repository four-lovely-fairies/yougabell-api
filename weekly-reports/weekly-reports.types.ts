export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WeeklyReportCurrentResponse = {
  selectedChild: {
    id: string;
    name: string;
    ageLabel: string;
  };
  report: WeeklyReportDetail | null;
  emptyState: null | {
    reason:
      | 'no_mission_yet'
      | 'no_mission_for_week'
      | 'report_generation_pending';
    title: string;
    description: string;
    ctaLabel: '놀이 시작하기';
    ctaHref: '/mission';
  };
};

/** 지난 리포트 고르기(리포트 화면 상단 "N월 N일 발행" 드롭다운)용 목록 한 줄 */
export type WeeklyReportListItem = {
  id: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  viewed: boolean;
};

export type WeeklyReportListResponse = {
  childId: string | null;
  items: WeeklyReportListItem[];
};

export type WeeklyReportUnviewedStatus = {
  hasUnviewedReport: boolean;
};

export type WeeklyReportViewedResponse = {
  viewed: true;
};

export type WeeklyReportDetail = {
  id: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  headline: {
    question: '나는 잘하고 있는가?';
    title: string;
    body: string | null;
  };
  missionSummary: {
    days: Array<{
      weekday: Weekday;
      label: '월' | '화' | '수' | '목' | '금' | '토' | '일';
      completedCount: number;
      completed: boolean;
    }>;
    totalDurationSeconds: number;
    totalDurationLabel: string;
    childPositiveReactionRate: number;
  };
  topKeywords: Array<{
    rank: 1 | 2 | 3;
    keyword: string;
  }>;
  keywordEmptyState: null | {
    title: '아직 키워드가 충분하지 않아요';
    description: string;
  };
  bestMoments: Array<{
    id: string;
    order: number;
    label?: string;
    title: string;
    body: string;
  }>;
  innerState: {
    psychologicalEnergy: number;
    tipTitle: string;
    tipBody?: string;
  };
  aiActionSuggestion: {
    title: '미래 행동 제안 (AI 기반)';
    body: string;
  };
};
