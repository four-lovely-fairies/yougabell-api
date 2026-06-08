import { MissionExecutionStatus, Prisma } from '@prisma/client';

export const CURRENT_MISSION_SELECT = {
  id: true,
  title: true,
  description: true,
  subThemeLabel: true,
  durationMinutes: true,
  category: { select: { label: true } },
  sources: { select: { citation: true }, orderBy: { citation: 'asc' } },
} satisfies Prisma.MissionSelect;

export type CurrentMissionRow = Prisma.MissionGetPayload<{
  select: typeof CURRENT_MISSION_SELECT;
}>;

export type CurrentMissionStatus = 'not_started' | 'in_progress' | 'completed';

export const ACTIVE_EXECUTION_SELECT = {
  id: true,
  childId: true,
  missionId: true,
  status: true,
  startedAt: true,
  activeSegmentStartedAt: true,
  pausedAt: true,
  elapsedSeconds: true,
  mission: { select: { durationMinutes: true } },
} satisfies Prisma.MissionExecutionSelect;

export type ActiveExecutionRow = Prisma.MissionExecutionGetPayload<{
  select: typeof ACTIVE_EXECUTION_SELECT;
}>;

export const EFFECT_EXECUTION_SELECT = {
  id: true,
  status: true,
  completedAt: true,
  actualDurationSeconds: true,
  wasEarlyCompleted: true,
  child: { select: { deletedAt: true } },
  mission: {
    select: {
      id: true,
      title: true,
      effect: true,
      goal: true,
      subThemeLabel: true,
    },
  },
} satisfies Prisma.MissionExecutionSelect;

export const FEEDBACK_EXECUTION_SELECT = {
  id: true,
  status: true,
  child: { select: { deletedAt: true } },
} satisfies Prisma.MissionExecutionSelect;

export const FEEDBACK_SELECT = {
  id: true,
  executionId: true,
  childReaction: true,
  parentEnergy: true,
  missionSatisfaction: true,
  note: true,
  createdAt: true,
  keywords: {
    select: { keyword: true, rank: true },
    orderBy: { rank: 'asc' },
  },
} satisfies Prisma.MissionFeedbackSelect;

export type FeedbackRow = Prisma.MissionFeedbackGetPayload<{
  select: typeof FEEDBACK_SELECT;
}>;

export const ACTIVE_MISSION_STATUSES: MissionExecutionStatus[] = [
  'in_progress',
  'paused',
];
