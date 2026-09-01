import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HomeService } from './home.service';

void describe('HomeService', () => {
  void it('uses the shared current mission recommendation for the home card', async () => {
    const prisma = createPrismaStub({
      children: [
        {
          id: 'child-1',
          userId: 'user-1',
          name: '김유스',
          birthDate: new Date('2024-07-24T00:00:00+09:00'),
          displayOrder: 0,
          createdAt: new Date('2026-05-01T00:00:00+09:00'),
        },
      ],
      milestones: [{ id: 'milestone-1', categoryId: 'social' }],
      missionByFindFirst: {
        id: 'm1',
        title: '첫 번째 놀이',
        description: 'old path',
        subThemeLabel: '아이 6분 가까워지기',
        durationMinutes: 6,
        category: { label: '사회성' },
        sources: [],
      },
      recommendCandidates: [
        {
          id: 'm1',
          title: '첫 번째 놀이',
          description: 'a',
          subThemeLabel: '아이 6분 가까워지기',
          durationMinutes: 6,
          category: { label: '사회성' },
          sources: [],
        },
        {
          id: 'm2',
          title: '공유 추천 놀이',
          description: 'b',
          subThemeLabel: '아이 6분 가까워지기',
          durationMinutes: 6,
          category: { label: '사회성' },
          sources: [],
        },
      ],
      missionCounts: [{ missionId: 'm1', _count: { _all: 1 } }],
      completedExecutions: [
        {
          startedAt: new Date('2026-07-22T12:00:00+09:00'),
          completedAt: new Date('2026-07-22T12:10:00+09:00'),
        },
        {
          startedAt: new Date('2026-07-23T12:00:00+09:00'),
          completedAt: new Date('2026-07-23T12:10:00+09:00'),
        },
      ],
    });
    const service = new HomeService(prisma as never);

    const result = await service.getHome('user-1', { date: '2026-07-24' });

    assert.equal(result.recommendedMission?.id, 'm2');
    assert.equal(result.recommendedMission?.title, '공유 추천 놀이');
    assert.equal(result.recommendedMission?.status, 'not_started');
    assert.equal(result.playStreakDays, 2);
  });

  void it('creates a new mood check when today has no record', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      existingCheck: null,
      createdCheck: {
        id: 'check-1',
        userId: 'user-1',
        level: 4,
        checkedAt: new Date('2026-05-28T10:30:00+09:00'),
      },
      onCreate: (args) => createCalls.push(args),
    });
    const service = new HomeService(prisma as never);

    const result = await service.upsertTodayMood('user-1', 4);

    assert.equal(result.level, 4);
    assert.equal(result.emoji, '😊');
    assert.match(result.checkedAt, /2026-05-28T/);
    assert.equal(createCalls.length, 1);
  });

  void it('returns the completed play count from the same weekly report as the reaction rate', async () => {
    const weeklyReportQueries: unknown[] = [];
    const prisma = createPrismaStub({
      children: [
        {
          id: 'child-1',
          userId: 'user-1',
          name: '김유스',
          birthDate: new Date('2024-07-24T00:00:00+09:00'),
          displayOrder: 0,
          createdAt: new Date('2026-05-01T00:00:00+09:00'),
        },
      ],
      weeklyReport: {
        id: 'report-1',
        weekStart: new Date('2026-07-13T00:00:00+09:00'),
        weekEnd: new Date('2026-07-19T00:00:00+09:00'),
        totalMissionDurationSeconds: 1200,
        childPositiveReactionRate: 0.75,
        days: [{ completedCount: 2 }, { completedCount: 1 }],
      },
      onWeeklyReportFind: (args) => weeklyReportQueries.push(args),
    });
    const service = new HomeService(prisma as never);

    const result = await service.getHome('user-1', { date: '2026-07-24' });

    assert.equal(result.reportSummary?.completedPlayCount, 3);
    assert.equal(result.reportSummary?.childPositiveReactionRate, 75);
    assert.deepEqual(weeklyReportQueries[0], {
      where: {
        childId: 'child-1',
        weekStart: new Date('2026-07-12T15:00:00.000Z'),
      },
      include: { days: true },
    });
  });

  void it('현재 월령 체크포인트의 발달 지표 완료 수를 반환한다', async () => {
    const milestoneQueries: unknown[] = [];
    const completionQueries: unknown[] = [];
    const prisma = createPrismaStub({
      children: [
        {
          id: 'child-1',
          userId: 'user-1',
          name: '김유스',
          birthDate: new Date('2023-06-24T00:00:00+09:00'),
          displayOrder: 0,
          createdAt: new Date('2026-05-01T00:00:00+09:00'),
        },
      ],
      milestones: [
        { id: 'milestone-1' },
        { id: 'milestone-2' },
        { id: 'milestone-3' },
      ],
      completedMilestoneCount: 2,
      onMilestoneFind: (args) => milestoneQueries.push(args),
      onCompletionCount: (args) => completionQueries.push(args),
    });
    const service = new HomeService(prisma as never);

    const result = await service.getHome('user-1', { date: '2026-07-24' });

    assert.deepEqual(result.roadmapProgress, {
      targetMonth: 36,
      completedCount: 2,
      totalCount: 3,
    });
    assert.deepEqual(milestoneQueries[0], {
      where: {
        ageMonthsFrom: { lt: 36 },
        ageMonthsTo: { gte: 36 },
        categoryId: {
          in: ['social', 'language', 'cognitive', 'physical'],
        },
      },
      select: { id: true },
    });
    assert.deepEqual(completionQueries[0], {
      where: {
        childId: 'child-1',
        milestoneId: {
          in: ['milestone-1', 'milestone-2', 'milestone-3'],
        },
      },
    });
  });

  void it('updates the latest mood check when today already has a record', async () => {
    const updateCalls: unknown[] = [];
    const prisma = createPrismaStub({
      existingCheck: {
        id: 'check-1',
        userId: 'user-1',
        level: 2,
        checkedAt: new Date('2026-05-28T09:00:00+09:00'),
      },
      updatedCheck: {
        id: 'check-1',
        userId: 'user-1',
        level: 5,
        checkedAt: new Date('2026-05-28T10:45:00+09:00'),
      },
      onUpdate: (args) => updateCalls.push(args),
    });
    const service = new HomeService(prisma as never);

    const result = await service.upsertTodayMood('user-1', 5);

    assert.equal(result.level, 5);
    assert.equal(result.emoji, '🥰');
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(updateCalls[0], {
      where: { id: 'check-1' },
      data: {
        level: 5,
        checkedAt: updateCallsCheckedAt(updateCalls[0]),
      },
    });
  });
});

function updateCallsCheckedAt(call: unknown): Date {
  return (call as { data: { checkedAt: Date } }).data.checkedAt;
}

function createPrismaStub(options: {
  children?: Array<{
    id: string;
    userId: string;
    name: string;
    birthDate: Date;
    displayOrder: number;
    createdAt: Date;
  }>;
  milestones?: Array<{ id: string; categoryId?: string }>;
  completedMilestoneCount?: number;
  onMilestoneFind?: (args: unknown) => void;
  onCompletionCount?: (args: unknown) => void;
  missionByFindFirst?: {
    id: string;
    title: string;
    description: string;
    subThemeLabel: string | null;
    durationMinutes: number;
    category: { label: string };
    sources: Array<{ citation?: string }>;
  } | null;
  recommendCandidates?: Array<{
    id: string;
    title: string;
    description: string;
    subThemeLabel: string | null;
    durationMinutes: number;
    category: { label: string };
    sources: Array<{ citation?: string }>;
  }>;
  missionCounts?: Array<{ missionId: string; _count: { _all: number } }>;
  currentDayExecution?: {
    status: 'in_progress' | 'paused' | 'completed' | 'early_completed';
    mission: {
      id: string;
      title: string;
      description: string;
      subThemeLabel: string | null;
      durationMinutes: number;
      category: { label: string };
      sources: Array<{ citation?: string }>;
    };
  } | null;
  completedExecutions?: Array<{
    startedAt: Date;
    completedAt: Date | null;
  }>;
  weeklyReport?: {
    id: string;
    weekStart: Date;
    weekEnd: Date;
    totalMissionDurationSeconds: number;
    childPositiveReactionRate: number;
    days: Array<{ completedCount: number }>;
  } | null;
  onWeeklyReportFind?: (args: unknown) => void;
  existingCheck?: {
    id: string;
    userId: string;
    level: number;
    checkedAt: Date;
  } | null;
  createdCheck?: {
    id: string;
    userId: string;
    level: number;
    checkedAt: Date;
  };
  updatedCheck?: {
    id: string;
    userId: string;
    level: number;
    checkedAt: Date;
  };
  onCreate?: (args: unknown) => void;
  onUpdate?: (args: unknown) => void;
}) {
  return {
    child: {
      findMany: () => Promise.resolve(options.children ?? []),
    },
    milestone: {
      findMany: (args: unknown) => {
        options.onMilestoneFind?.(args);
        return Promise.resolve(options.milestones ?? []);
      },
    },
    childMilestoneCompletion: {
      count: (args: unknown) => {
        options.onCompletionCount?.(args);
        return Promise.resolve(options.completedMilestoneCount ?? 0);
      },
    },
    mission: {
      findMany: () => Promise.resolve(options.recommendCandidates ?? []),
      findFirst: () => Promise.resolve(options.missionByFindFirst ?? null),
      aggregate: () =>
        Promise.resolve({
          _min: { recommendedAgeMonthsMin: null },
          _max: { recommendedAgeMonthsMax: null },
        }),
    },
    missionExecution: {
      findMany: (args: { where?: { status?: unknown } }) =>
        Promise.resolve(
          args.where?.status ? (options.completedExecutions ?? []) : [],
        ),
      findFirst: () => Promise.resolve(options.currentDayExecution ?? null),
      groupBy: () => Promise.resolve(options.missionCounts ?? []),
    },
    weeklyReport: {
      findFirst: (args: unknown) => {
        options.onWeeklyReportFind?.(args);
        return Promise.resolve(options.weeklyReport ?? null);
      },
    },
    growthStage: {
      findFirst: () => Promise.resolve(null),
    },
    notification: {
      count: () => Promise.resolve(0),
      findMany: () => Promise.resolve([]),
    },
    mentalBatteryCheck: {
      findMany: () => Promise.resolve([]),
      findFirst: () => Promise.resolve(options.existingCheck ?? null),
      create: (args: unknown) => {
        options.onCreate?.(args);
        return Promise.resolve(options.createdCheck);
      },
      update: (args: unknown) => {
        options.onUpdate?.(args);
        return Promise.resolve(options.updatedCheck);
      },
    },
  };
}
