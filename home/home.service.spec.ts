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
      milestones: [{ categoryId: 'social' }],
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
    });
    const service = new HomeService(prisma as never);

    const result = await service.getHome('user-1', { date: '2026-07-24' });

    assert.equal(result.recommendedMission?.id, 'm2');
    assert.equal(result.recommendedMission?.title, '공유 추천 놀이');
    assert.equal(result.recommendedMission?.status, 'not_started');
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
  milestones?: Array<{ categoryId: string }>;
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
      findMany: () => Promise.resolve(options.milestones ?? []),
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
      findMany: () => Promise.resolve([]),
      findFirst: () => Promise.resolve(options.currentDayExecution ?? null),
      groupBy: () => Promise.resolve(options.missionCounts ?? []),
    },
    weeklyReport: {
      findFirst: () => Promise.resolve(null),
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
