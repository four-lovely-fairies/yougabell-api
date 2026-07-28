/**
 * 운영자 통계 응답 타입.
 *
 * 접속 로그 테이블이 없으므로 **활동 이벤트(오늘의 놀이 · 오늘의 기분 · 마음 케어 ·
 * 챗)** 를 재접속 프록시로 사용한다. "활성 사용자"는 해당 날짜에 위 이벤트를
 * 1건 이상 남긴 사용자다.
 */

export const ACTIVITY_KINDS = ['mission', 'mood', 'care', 'chat'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type StatsRange = {
  from: string; // ISO, 구간 시작 (포함)
  to: string; // ISO, 구간 끝 (미포함)
  days: number;
  timezone: 'Asia/Seoul';
};

export type StatsTotals = {
  users: number; // 온보딩 완료 · 미탈퇴
  children: number;
  newUsers: number; // 기간 내 가입
  activeUsers: number; // 기간 내 1일 이상 활동
  returningUsers: number; // 기간 내 2일 이상 활동
  returningRate: number; // returningUsers / activeUsers (0..1)
  avgActiveDays: number; // 활성 사용자 1인당 평균 활동일수
  missionExecutions: number;
  missionCompleted: number;
  missionCompletionRate: number; // 0..1
  moodChecks: number;
  avgMoodLevel: number | null; // 1..5
  careExecutions: number;
  chatMessages: number; // 사용자 발화만
};

export type DailyPoint = {
  date: string; // YYYY-MM-DD (KST)
  activeUsers: number;
  newUsers: number;
  mission: number;
  mood: number;
  care: number;
  chat: number;
};

export type ActiveDaysBucket = {
  bucket: '1' | '2-3' | '4-7' | '8-14' | '15+';
  users: number;
};

export type WeekdayPoint = {
  /** 1=월 … 7=일 (ISO) */
  weekday: number;
  events: number;
  activeUsers: number;
};

export type HourPoint = { hour: number; events: number };

export type MoodLevelPoint = { level: number; count: number };

export type MoodDailyPoint = {
  date: string;
  avgLevel: number | null;
  count: number;
};

export type MissionStatusPoint = { status: string; count: number };

export type TopMissionPoint = {
  missionId: string;
  title: string;
  categoryId: string;
  executions: number;
  completed: number;
  avgSatisfaction: number | null;
};

export type CategoryPoint = {
  categoryId: string;
  label: string;
  executions: number;
};

export type FeedbackSummary = {
  count: number;
  avgChildReaction: number | null; // 1..5
  avgParentEnergy: number | null; // 0..10
  avgMissionSatisfaction: number | null; // 1..5
};

export type KeywordPoint = { keyword: string; count: number };

export type EngagementStats = {
  range: StatsRange;
  totals: StatsTotals;
  daily: DailyPoint[];
  activeDays: ActiveDaysBucket[];
  weekday: WeekdayPoint[];
  hourly: HourPoint[];
  moodLevels: MoodLevelPoint[];
  moodDaily: MoodDailyPoint[];
  missionStatus: MissionStatusPoint[];
  topMissions: TopMissionPoint[];
  categories: CategoryPoint[];
  feedback: FeedbackSummary;
  keywords: KeywordPoint[];
};
