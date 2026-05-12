import {
  NotificationActionType,
  NotificationTargetType,
  MissionExecutionStatus,
} from '@prisma/client';
import { HomeWeekDay } from './home-date.utils';

export type HomeChild = {
  id: string;
  name: string;
  birthDate: string;
  ageLabel: string;
  displayOrder: number;
};

export type HomeDashboard = {
  selectedChild: HomeChild;
  children: HomeChild[];
  week: {
    monthLabel: string;
    weekOfMonthLabel: string;
    days: Array<
      HomeWeekDay & {
        mood?: {
          level: 1 | 2 | 3 | 4 | 5;
          emoji: string;
        };
        missionCompleted?: boolean;
      }
    >;
  };
  recommendedMission: {
    id: string;
    subThemeLabel: string;
    title: string;
    durationMinutes: number;
    status: 'not_started' | 'in_progress' | 'completed';
  } | null;
  growthStage: {
    id: string;
    name: string;
    summary: string;
  } | null;
  reportSummary: {
    monthTogetherDaysPercent: number;
    completedDays: number;
    elapsedDays: number;
    label: string;
  } | null;
  notifications: {
    unreadCount: number;
    latest: HomeNotificationSummaryItem[];
  };
};

export type HomeNotificationSummaryItem = {
  id: string;
  title: string;
  body: string;
  actionType: NotificationActionType;
  targetType: NotificationTargetType | null;
  targetId: string | null;
  targetUrl: string | null;
  createdAt: string;
  readAt: string | null;
};

export function toRecommendedMissionStatus(
  status: MissionExecutionStatus | null,
): 'not_started' | 'in_progress' | 'completed' {
  if (status === 'completed' || status === 'early_completed') {
    return 'completed';
  }
  if (status === 'in_progress' || status === 'paused') {
    return 'in_progress';
  }
  return 'not_started';
}
