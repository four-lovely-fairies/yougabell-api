import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MissionsService } from './missions.service';

void describe('MissionsService', () => {
  void it('lists admin missions with flattened tags and sources', async () => {
    const prisma = createPrismaStub({
      listedMissions: [
        {
          id: 'mission-1',
          categoryId: 'language',
          title: '짝짜꿍 노래 게임',
          shortTitle: '짝짜꿍',
          description: '설명',
          durationMinutes: 10,
          effect: '정서적 안정감',
          subThemeLabel: '아이와 10분 가까워지기',
          goal: '사회성',
          recommendedAgeMonthsMin: 24,
          recommendedAgeMonthsMax: 48,
          thumbnailUrl: null,
          videoUrl: null,
          createdAt: new Date('2026-05-18T00:00:00+09:00'),
          updatedAt: new Date('2026-05-18T00:00:00+09:00'),
          tags: [{ tag: '감정' }, { tag: '말놀이' }],
          sources: [{ citation: 'CDC', url: null, note: null }],
        },
      ],
    });
    const service = new MissionsService(prisma as never);

    const result = await service.list({});

    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0]?.tags, ['감정', '말놀이']);
    assert.deepEqual(result.items[0]?.sources, [
      { citation: 'CDC', url: null, note: null },
    ]);
  });

  void it('creates an admin mission with normalized optional fields', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      createdMission: {
        id: 'mission-1',
        categoryId: 'language',
        title: '짝짜꿍 노래 게임',
        shortTitle: '짝짜꿍',
        description: '설명',
        durationMinutes: 10,
        effect: '정서적 안정감',
        subThemeLabel: null,
        goal: null,
        recommendedAgeMonthsMin: null,
        recommendedAgeMonthsMax: null,
        thumbnailUrl: null,
        videoUrl: null,
        createdAt: new Date('2026-05-18T00:00:00+09:00'),
        updatedAt: new Date('2026-05-18T00:00:00+09:00'),
        tags: [{ tag: '감정' }],
        sources: [{ citation: 'CDC', url: null, note: null }],
      },
      onMissionCreate: (args) => createCalls.push(args),
    });
    const service = new MissionsService(prisma as never);

    const result = await service.create({
      categoryId: 'language',
      title: '짝짜꿍 노래 게임',
      shortTitle: '짝짜꿍',
      description: '설명',
      durationMinutes: 10,
      effect: '정서적 안정감',
      tags: [' 감정 ', '감정'],
      sources: [{ citation: ' CDC ' }],
    });

    const createArg = createCalls[0] as {
      data: {
        subThemeLabel: null;
        goal: null;
        tags: { createMany: { data: Array<{ tag: string }> } };
        sources: { createMany: { data: Array<{ citation: string }> } };
      };
    };
    assert.equal(createArg.data.subThemeLabel, null);
    assert.equal(createArg.data.goal, null);
    assert.deepEqual(createArg.data.tags.createMany.data, [{ tag: '감정' }]);
    assert.deepEqual(createArg.data.sources.createMany.data, [
      { citation: 'CDC', url: null, note: null },
    ]);
    assert.equal(result.id, 'mission-1');
  });

  void it('updates an admin mission with nested tag/source replacement', async () => {
    const updateCalls: unknown[] = [];
    const prisma = createPrismaStub({
      updatedMissionRow: {
        id: 'mission-1',
        categoryId: 'language',
        title: '짝짜꿍 노래 게임',
        shortTitle: '짝짜꿍',
        description: '설명',
        durationMinutes: 8,
        effect: '정서적 안정감',
        subThemeLabel: '아이와 10분 가까워지기',
        goal: '사회성',
        recommendedAgeMonthsMin: 24,
        recommendedAgeMonthsMax: 48,
        thumbnailUrl: null,
        videoUrl: null,
        createdAt: new Date('2026-05-18T00:00:00+09:00'),
        updatedAt: new Date('2026-05-18T00:00:00+09:00'),
        tags: [{ tag: '감정' }],
        sources: [{ citation: 'CDC', url: null, note: null }],
      },
      onMissionUpdate: (args) => updateCalls.push(args),
    });
    const service = new MissionsService(prisma as never);

    await service.update('mission-1', {
      durationMinutes: 8,
      tags: ['감정'],
      sources: [{ citation: 'CDC' }],
    });

    const updateArg = updateCalls[0] as {
      data: {
        tags: {
          deleteMany: Record<string, never>;
          createMany: { data: Array<{ tag: string }> };
        };
        sources: {
          deleteMany: Record<string, never>;
          createMany: { data: Array<{ citation: string }> };
        };
      };
    };
    assert.deepEqual(updateArg.data.tags.createMany.data, [{ tag: '감정' }]);
    assert.deepEqual(updateArg.data.sources.createMany.data, [
      { citation: 'CDC', url: null, note: null },
    ]);
  });

  void it('returns the current mission with active execution snapshot', async () => {
    const prisma = createPrismaStub({
      children: [
        {
          id: 'child-1',
          userId: 'user-1',
          name: '김유스',
          birthDate: new Date('2023-04-20T00:00:00+09:00'),
          displayOrder: 0,
          createdAt: new Date('2026-05-01T00:00:00+09:00'),
        },
      ],
      milestones: [{ categoryId: 'language' }],
      mission: {
        id: 'mission-1',
        title: '짝짜꿍 노래 게임',
        description: '아이와 마주 앉아 손뼉을 마주친다.',
        subThemeLabel: '아이와 10분 가까워지기',
        durationMinutes: 10,
        category: { label: '언어발달' },
        sources: [{ citation: 'CDC' }],
      },
      activeExecution: {
        id: 'execution-1',
        childId: 'child-1',
        missionId: 'mission-1',
        status: 'paused',
        startedAt: new Date('2026-05-18T09:00:00+09:00'),
        activeSegmentStartedAt: null,
        pausedAt: new Date('2026-05-18T09:02:00+09:00'),
        elapsedSeconds: 120,
        mission: { durationMinutes: 10 },
      },
    });
    const service = new MissionsService(prisma as never);

    const result = await service.getCurrentMission('user-1', {});

    assert.equal(result.selectedChild.id, 'child-1');
    assert.equal(result.mission.id, 'mission-1');
    assert.equal(result.mission.categoryLabel, '언어발달');
    assert.equal(result.mission.sourceLabel, 'CDC');
    assert.equal(result.activeExecution?.id, 'execution-1');
    assert.equal(result.activeExecution?.status, 'paused');
    assert.equal(result.activeExecution?.remainingSeconds, 480);
  });

  void it('reuses an existing active execution instead of creating a new one', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      activeChild: {
        id: 'child-1',
        userId: 'user-1',
        deletedAt: null,
      },
      missionById: {
        id: 'mission-1',
      },
      activeExecution: {
        id: 'execution-1',
        childId: 'child-1',
        missionId: 'mission-1',
        status: 'in_progress',
        startedAt: new Date('2026-05-18T09:00:00+09:00'),
        activeSegmentStartedAt: new Date('2026-05-18T09:00:00+09:00'),
        pausedAt: null,
        elapsedSeconds: 0,
        mission: { durationMinutes: 10 },
      },
      onCreate: (args) => createCalls.push(args),
    });
    const service = new MissionsService(prisma as never);

    const result = await service.startMissionExecution('user-1', {
      childId: 'child-1',
      missionId: 'mission-1',
    });

    assert.equal(createCalls.length, 0);
    assert.equal(result.execution?.id, 'execution-1');
  });

  void it('pauses an in-progress execution and stores accumulated elapsed seconds', async () => {
    const updateCalls: unknown[] = [];
    const prisma = createPrismaStub({
      executionForAction: {
        id: 'execution-1',
        userId: 'user-1',
        childId: 'child-1',
        missionId: 'mission-1',
        status: 'in_progress',
        startedAt: new Date('2026-05-18T09:00:00+09:00'),
        activeSegmentStartedAt: new Date(Date.now() - 31_000),
        pausedAt: null,
        elapsedSeconds: 120,
        child: { deletedAt: null },
        mission: { durationMinutes: 10 },
      },
      updatedExecution: {
        id: 'execution-1',
        childId: 'child-1',
        missionId: 'mission-1',
        status: 'paused',
        startedAt: new Date('2026-05-18T09:00:00+09:00'),
        activeSegmentStartedAt: null,
        pausedAt: new Date(),
        elapsedSeconds: 151,
        mission: { durationMinutes: 10 },
      },
      onUpdate: (args) => updateCalls.push(args),
    });
    const service = new MissionsService(prisma as never);

    const result = await service.applyMissionExecutionAction(
      'user-1',
      'execution-1',
      'pause',
    );

    const updateArg = updateCalls[0] as {
      data: { status: string; elapsedSeconds: number };
    };
    assert.equal(updateArg.data.status, 'paused');
    assert.equal(updateArg.data.elapsedSeconds >= 150, true);
    assert.equal(result.execution?.status, 'paused');
  });
});

function createPrismaStub(options: {
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
  onCreate?: (args: unknown) => void;
  onUpdate?: (args: unknown) => void;
  onMissionCreate?: (args: unknown) => void;
  onMissionUpdate?: (args: unknown) => void;
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
      findMany: () => Promise.resolve(options.listedMissions ?? []),
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
      findFirst: (args: { where?: { id?: string } }) =>
        Promise.resolve(
          args.where?.id
            ? (options.executionForAction ?? null)
            : (options.activeExecution ?? null),
        ),
      create: (args: unknown) => {
        options.onCreate?.(args);
        return Promise.resolve(options.activeExecution);
      },
      update: (args: unknown) => {
        options.onUpdate?.(args);
        return Promise.resolve(options.updatedExecution);
      },
    },
  };
}
