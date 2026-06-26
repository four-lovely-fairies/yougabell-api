// missions.service.spec 공용 Prisma stub (테스트 전용).
export function createPrismaStub(options: {
  listedMissions?: Array<{
    id: string;
    categoryId: string;
    title: string;
    shortTitle: string;
    description: string;
    durationMinutes: number;
    effect: string;
    subThemeLabel: string | null;
    goal: string | null;
    recommendedAgeMonthsMin: number | null;
    recommendedAgeMonthsMax: number | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    tags: Array<{ tag: string }>;
    sources: Array<{
      citation: string;
      url: string | null;
      note: string | null;
    }>;
  }>;
  createdMission?: {
    id: string;
    categoryId: string;
    title: string;
    shortTitle: string;
    description: string;
    durationMinutes: number;
    effect: string;
    subThemeLabel: string | null;
    goal: string | null;
    recommendedAgeMonthsMin: number | null;
    recommendedAgeMonthsMax: number | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    tags: Array<{ tag: string }>;
    sources: Array<{
      citation: string;
      url: string | null;
      note: string | null;
    }>;
  } | null;
  updatedMissionRow?: {
    id: string;
    categoryId: string;
    title: string;
    shortTitle: string;
    description: string;
    durationMinutes: number;
    effect: string;
    subThemeLabel: string | null;
    goal: string | null;
    recommendedAgeMonthsMin: number | null;
    recommendedAgeMonthsMax: number | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    tags: Array<{ tag: string }>;
    sources: Array<{
      citation: string;
      url: string | null;
      note: string | null;
    }>;
  } | null;
  children?: Array<{
    id: string;
    userId: string;
    name: string;
    birthDate: Date;
    displayOrder: number;
    createdAt: Date;
  }>;
  milestones?: Array<{ categoryId: string }>;
  mission?: {
    id: string;
    title: string;
    description: string;
    subThemeLabel: string | null;
    durationMinutes: number;
    category: { label: string };
    sources: Array<{ citation: string }>;
  } | null;
  recommendCandidates?: Array<{
    id: string;
    title: string;
    description: string;
    subThemeLabel: string | null;
    durationMinutes: number;
    category: { label: string };
    sources: Array<{ citation: string }>;
  }>;
  missionCounts?: Array<{ missionId: string; _count: { _all: number } }>;
  // 놀이 카탈로그의 추천 월령 경계 (clampAgeToMissionCatalog 검증용). 미지정 시 null = 클램프 없음.
  missionAgeBounds?: { min: number | null; max: number | null };
  currentDayExecution?: {
    status: 'in_progress' | 'paused' | 'completed' | 'early_completed';
    mission: {
      id: string;
      title: string;
      description: string;
      subThemeLabel: string | null;
      durationMinutes: number;
      category: { label: string };
      sources: Array<{ citation: string }>;
    };
  } | null;
  activeExecution?: {
    id: string;
    childId: string;
    missionId: string;
    status: 'in_progress' | 'paused';
    startedAt: Date;
    activeSegmentStartedAt: Date | null;
    pausedAt: Date | null;
    elapsedSeconds: number;
    mission: { durationMinutes: number };
  } | null;
  activeChild?: {
    id: string;
    userId: string;
    deletedAt: Date | null;
  } | null;
  missionById?: { id: string } | null;
  executionForAction?: {
    id: string;
    userId: string;
    childId: string;
    missionId: string;
    status: 'in_progress' | 'paused' | 'completed' | 'early_completed';
    startedAt: Date;
    activeSegmentStartedAt: Date | null;
    pausedAt: Date | null;
    elapsedSeconds: number;
    child: { deletedAt: Date | null };
    mission: { durationMinutes: number };
  } | null;
  updatedExecution?: {
    id: string;
    childId: string;
    missionId: string;
    status: 'in_progress' | 'paused';
    startedAt: Date;
    activeSegmentStartedAt: Date | null;
    pausedAt: Date | null;
    elapsedSeconds: number;
    mission: { durationMinutes: number };
  } | null;
  effectExecution?: {
    id: string;
    status: 'completed' | 'early_completed';
    completedAt: Date | null;
    actualDurationSeconds: number | null;
    wasEarlyCompleted: boolean;
    child: { deletedAt: Date | null };
    mission: {
      id: string;
      title: string;
      effect: string;
      goal: string | null;
      subThemeLabel: string | null;
    };
  } | null;
  feedbackExecution?: {
    id: string;
    status: 'completed' | 'early_completed';
    child: { deletedAt: Date | null };
  } | null;
  upsertedFeedback?: {
    id: string;
    executionId: string;
    childReaction: number;
    parentEnergy: number;
    missionSatisfaction: number;
    note: string | null;
    createdAt: Date;
    keywords: Array<{ keyword: string; rank: number }>;
  } | null;
  onCreate?: (args: unknown) => void;
  onUpdate?: (args: unknown) => void;
  onMissionCreate?: (args: unknown) => void;
  onMissionUpdate?: (args: unknown) => void;
  onFeedbackUpsert?: (args: unknown) => void;
}) {
  return {
    child: {
      findMany: () => Promise.resolve(options.children ?? []),
      findFirst: () => Promise.resolve(options.activeChild ?? null),
    },
    milestone: {
      findMany: () => Promise.resolve(options.milestones ?? []),
    },
    mission: {
      findMany: () =>
        Promise.resolve(
          options.listedMissions ?? options.recommendCandidates ?? [],
        ),
      aggregate: () =>
        Promise.resolve({
          _min: {
            recommendedAgeMonthsMin: options.missionAgeBounds?.min ?? null,
          },
          _max: {
            recommendedAgeMonthsMax: options.missionAgeBounds?.max ?? null,
          },
        }),
      findFirst: () => Promise.resolve(options.mission ?? null),
      findUnique: () => Promise.resolve(options.missionById ?? null),
      create: (args: unknown) => {
        options.onMissionCreate?.(args);
        return Promise.resolve(options.createdMission);
      },
      update: (args: unknown) => {
        options.onMissionUpdate?.(args);
        return Promise.resolve(options.updatedMissionRow);
      },
      delete: () => Promise.resolve(undefined),
    },
    missionExecution: {
      findFirst: (args: {
        where?: {
          id?: string;
          status?: { in?: string[]; not?: string };
        };
      }) => {
        if (!args.where?.id) {
          if (args.where?.status?.not === 'cancelled') {
            return Promise.resolve(options.currentDayExecution ?? null);
          }
          return Promise.resolve(options.activeExecution ?? null);
        }

        if (options.effectExecution) {
          return Promise.resolve(options.effectExecution);
        }

        if (options.feedbackExecution) {
          return Promise.resolve(options.feedbackExecution);
        }

        return Promise.resolve(options.executionForAction ?? null);
      },
      groupBy: () => Promise.resolve(options.missionCounts ?? []),
      create: (args: unknown) => {
        options.onCreate?.(args);
        return Promise.resolve(options.activeExecution);
      },
      update: (args: unknown) => {
        options.onUpdate?.(args);
        return Promise.resolve(options.updatedExecution);
      },
    },
    missionFeedback: {
      upsert: (args: unknown) => {
        options.onFeedbackUpsert?.(args);
        return Promise.resolve(options.upsertedFeedback ?? null);
      },
    },
  };
}
