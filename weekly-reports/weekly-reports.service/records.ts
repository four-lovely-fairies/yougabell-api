import type { WeeklyReportAiPayload } from '../../ai/prompts/weekly-report';
import type { Weekday } from '../weekly-reports.types';

export type AiGenerationResult = {
  payload: WeeklyReportAiPayload;
  promptTokens: number | null;
  completionTokens: number | null;
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
    updateMany(args: unknown): Promise<{ count: number }>;
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

export type WeeklyReportRecord = {
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

export type MissionExecutionForReport = {
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
