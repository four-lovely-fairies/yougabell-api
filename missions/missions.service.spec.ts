import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MissionsService } from './missions.service';
import { createPrismaStub } from './missions.service.stub';

void describe('MissionsService', () => {
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
      currentDayExecution: {
        status: 'paused',
        mission: {
          id: 'mission-1',
          title: '짝짜꿍 노래 게임',
          description: '아이와 마주 앉아 손뼉을 마주친다.',
          subThemeLabel: '아이와 10분 가까워지기',
          durationMinutes: 10,
          category: { label: '언어발달' },
          sources: [{ citation: 'CDC' }],
        },
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
    assert.equal(result.selectedChild.birthDate, '2023-04-20');
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0]?.id, 'child-1');
    assert.equal(result.mission.id, 'mission-1');
    assert.equal(result.mission.status, 'in_progress');
    assert.equal(result.mission.categoryLabel, '언어발달');
    assert.equal(result.mission.sourceLabel, 'CDC');
    assert.equal(result.activeExecution?.id, 'execution-1');
    assert.equal(result.activeExecution?.status, 'paused');
    assert.equal(result.activeExecution?.remainingSeconds, 480);
  });

  void it('marks current mission as completed when a finished execution exists today', async () => {
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
      currentDayExecution: {
        status: 'completed',
        mission: {
          id: 'mission-1',
          title: '짝짜꿍 노래 게임',
          description: '아이와 마주 앉아 손뼉을 마주친다.',
          subThemeLabel: '아이와 10분 가까워지기',
          durationMinutes: 10,
          category: { label: '언어발달' },
          sources: [{ citation: 'CDC' }],
        },
      },
      activeExecution: null,
    });
    const service = new MissionsService(prisma as never);

    const result = await service.getCurrentMission('user-1', {});

    assert.equal(result.mission.id, 'mission-1');
    assert.equal(result.mission.status, 'completed');
    assert.equal(result.activeExecution, null);
  });

  const recommendChild = [
    {
      id: 'child-1',
      userId: 'user-1',
      name: '김유스',
      birthDate: new Date('2023-04-20T00:00:00+09:00'),
      displayOrder: 0,
      createdAt: new Date('2026-05-01T00:00:00+09:00'),
    },
  ];
  const recommendCandidates = [
    {
      id: 'm1',
      title: 'A',
      description: 'a',
      subThemeLabel: null,
      durationMinutes: 10,
      category: { label: '언어발달' },
      sources: [{ citation: 'CDC' }],
    },
    {
      id: 'm2',
      title: 'B',
      description: 'b',
      subThemeLabel: null,
      durationMinutes: 10,
      category: { label: '언어발달' },
      sources: [],
    },
    {
      id: 'm3',
      title: 'C',
      description: 'c',
      subThemeLabel: null,
      durationMinutes: 10,
      category: { label: '언어발달' },
      sources: [],
    },
  ];

  void it('recommends the least-performed mission (lowest completion count)', async () => {
    const prisma = createPrismaStub({
      children: recommendChild,
      milestones: [{ categoryId: 'language' }],
      recommendCandidates,
      // m1 2회, m3 1회, m2 0회 → 최저(0회)인 m2 추천
      missionCounts: [
        { missionId: 'm1', _count: { _all: 2 } },
        { missionId: 'm3', _count: { _all: 1 } },
      ],
      currentDayExecution: null,
      activeExecution: null,
    });
    const service = new MissionsService(prisma as never);

    const result = await service.getCurrentMission('user-1', {});

    assert.equal(result.mission.id, 'm2');
    assert.equal(result.mission.status, 'not_started');
  });

  void it('allows repeats once every mission has equal performance count', async () => {
    const prisma = createPrismaStub({
      children: recommendChild,
      milestones: [{ categoryId: 'language' }],
      recommendCandidates,
      // 모두 1회 → 최저 그룹 = 전체 → 그 안에서 로테이션(중복 허용)
      missionCounts: [
        { missionId: 'm1', _count: { _all: 1 } },
        { missionId: 'm2', _count: { _all: 1 } },
        { missionId: 'm3', _count: { _all: 1 } },
      ],
      currentDayExecution: null,
      activeExecution: null,
    });
    const service = new MissionsService(prisma as never);

    const result = await service.getCurrentMission('user-1', {});

    assert.ok(['m1', 'm2', 'm3'].includes(result.mission.id));
    assert.equal(result.mission.status, 'not_started');
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

  void it('returns effect payload for a finished execution', async () => {
    const prisma = createPrismaStub({
      effectExecution: {
        id: 'execution-1',
        status: 'completed',
        completedAt: new Date('2026-05-20T10:10:00+09:00'),
        actualDurationSeconds: 600,
        wasEarlyCompleted: false,
        child: { deletedAt: null },
        mission: {
          id: 'mission-1',
          title: '짝짜꿍 노래 게임',
          effect: '아이와 눈을 맞추는 시간이 늘어납니다.',
          goal: '사회성',
          subThemeLabel: '아이와 10분 가까워지기',
        },
      },
    });
    const service = new MissionsService(prisma as never);

    const result = await service.getMissionExecutionEffect(
      'user-1',
      'execution-1',
    );

    assert.equal(result.execution.id, 'execution-1');
    assert.equal(result.execution.actualDurationSeconds, 600);
    assert.equal(result.mission.title, '짝짜꿍 노래 게임');
    assert.equal(result.mission.goal, '사회성');
  });

  void it('upserts mission feedback with normalized keywords', async () => {
    const upsertCalls: unknown[] = [];
    const prisma = createPrismaStub({
      feedbackExecution: {
        id: 'execution-1',
        status: 'completed',
        child: { deletedAt: null },
      },
      upsertedFeedback: {
        id: 'feedback-1',
        executionId: 'execution-1',
        childReaction: 5,
        parentEnergy: 8,
        missionSatisfaction: 4,
        note: '공룡, Dinosaur\n자동차',
        createdAt: new Date('2026-05-20T10:20:00+09:00'),
        keywords: [
          { keyword: '공룡', rank: 1 },
          { keyword: 'dinosaur', rank: 2 },
          { keyword: '자동차', rank: 3 },
        ],
      },
      onFeedbackUpsert: (args) => upsertCalls.push(args),
    });
    const service = new MissionsService(prisma as never);

    const result = await service.upsertMissionFeedback(
      'user-1',
      'execution-1',
      {
        childReaction: 5,
        parentEnergy: 8,
        missionSatisfaction: 4,
        note: '공룡, Dinosaur\n자동차',
      },
    );

    const upsertArg = upsertCalls[0] as {
      create: {
        parentEnergy: number;
        keywords: {
          createMany: {
            data: Array<{ rank: number; keyword: string }>;
          };
        };
      };
      update: {
        parentEnergy: number;
      };
    };

    assert.equal(upsertArg.create.parentEnergy, 8);
    assert.equal(upsertArg.update.parentEnergy, 8);
    assert.deepEqual(upsertArg.create.keywords.createMany.data, [
      { rank: 1, keyword: '공룡' },
      { rank: 2, keyword: 'dinosaur' },
      { rank: 3, keyword: '자동차' },
    ]);
    assert.equal(result.feedback.parentEnergy, 8);
    assert.deepEqual(result.feedback.keywords, ['공룡', 'dinosaur', '자동차']);
  });
});
