import { Injectable } from '@nestjs/common';
import { MissionExecutionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_MISSION_LIMIT = 20;
const RECENT_BATTERY_DAYS = 7;
const RECENT_CHAT_HISTORY = 10;

/**
 * 기획 docs/features/20260525-ai-integration.md §6 "Context window" 결정 반영.
 * - user + children[]
 * - 최근 20건 MissionExecution (+ feedback)
 * - 최근 7일 MentalBatteryCheck
 * - 직전 WeeklyReport 요약
 * - chat history 최근 10개 (호출부에서 합성)
 *
 * 반환값은 LLM system prompt에 합성할 JSON-호환 객체.
 */
export type ChatContext = {
  user: {
    name: string;
    workStatus: string | null;
  };
  children: Array<{
    name: string;
    ageMonths: number;
    gender: string;
    notes: string | null;
  }>;
  recentMissions: Array<{
    title: string;
    status: MissionExecutionStatus;
    completedAt: string | null;
    feedback: {
      childReaction: number | null;
      parentEnergy: number | null;
      childKeywords: string[];
    } | null;
  }>;
  recentBatteryLevels: Array<{
    level: number;
    checkedAt: string;
  }>;
  lastWeeklyReport: {
    weekStart: string;
    headline: string;
    topKeywords: string[];
    psychologicalEnergy: number;
  } | null;
};

@Injectable()
export class ContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async forChat(userId: string): Promise<ChatContext> {
    const today = new Date();
    const batterySince = new Date(
      today.getTime() - RECENT_BATTERY_DAYS * 24 * 60 * 60 * 1000,
    );

    const [user, children, missions, batteryChecks, lastReport] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, workStatus: true },
        }),
        this.prisma.child.findMany({
          where: { userId, deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          select: { name: true, birthDate: true, gender: true, notes: true },
        }),
        this.prisma.missionExecution.findMany({
          where: { userId },
          orderBy: { startedAt: 'desc' },
          take: RECENT_MISSION_LIMIT,
          include: {
            mission: { select: { title: true } },
            feedback: {
              select: {
                childReaction: true,
                parentEnergy: true,
                keywords: { select: { keyword: true } },
              },
            },
          },
        }),
        this.prisma.mentalBatteryCheck.findMany({
          where: { userId, checkedAt: { gte: batterySince } },
          orderBy: { checkedAt: 'desc' },
          select: { level: true, checkedAt: true },
        }),
        this.prisma.weeklyReport.findFirst({
          where: { userId },
          orderBy: { weekStart: 'desc' },
          select: {
            weekStart: true,
            headline: true,
            psychologicalEnergy: true,
            topKeywords: {
              select: { keyword: true },
              orderBy: { rank: 'asc' },
            },
          },
        }),
      ]);

    return {
      user: {
        name: user?.name ?? '',
        workStatus: user?.workStatus ?? null,
      },
      children: children.map((child) => ({
        name: child.name,
        ageMonths: monthsBetween(child.birthDate, today),
        gender: child.gender,
        notes: child.notes ?? null,
      })),
      recentMissions: missions.map((execution) => ({
        title: execution.mission.title,
        status: execution.status,
        completedAt: execution.completedAt?.toISOString() ?? null,
        feedback: execution.feedback
          ? {
              childReaction: execution.feedback.childReaction,
              parentEnergy: execution.feedback.parentEnergy,
              childKeywords: execution.feedback.keywords.map(
                (keyword) => keyword.keyword,
              ),
            }
          : null,
      })),
      recentBatteryLevels: batteryChecks.map((check) => ({
        level: check.level,
        checkedAt: check.checkedAt.toISOString(),
      })),
      lastWeeklyReport: lastReport
        ? {
            weekStart: lastReport.weekStart.toISOString().slice(0, 10),
            headline: lastReport.headline,
            topKeywords: lastReport.topKeywords.map(
              (keyword) => keyword.keyword,
            ),
            psychologicalEnergy: lastReport.psychologicalEnergy,
          }
        : null,
    };
  }

  static readonly RECENT_CHAT_HISTORY = RECENT_CHAT_HISTORY;
}

function monthsBetween(birthDate: Date, today: Date): number {
  const years = today.getFullYear() - birthDate.getFullYear();
  const months = today.getMonth() - birthDate.getMonth();
  const total = years * 12 + months;
  return Math.max(0, total);
}
