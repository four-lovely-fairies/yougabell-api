import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WeeklyReportsPrisma,
  WeeklyReportsService,
} from './weekly-reports.service';

void describe('WeeklyReportsService', () => {
  void it('returns the current weekly report for the default active child', async () => {
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
      report: {
        id: 'report-1',
        userId: 'user-1',
        childId: 'child-1',
        weekStart: new Date('2026-05-04T00:00:00+09:00'),
        weekEnd: new Date('2026-05-10T00:00:00+09:00'),
        headline: '지금 충분히 잘하고 계십니다.',
        headlineBody: '짧은 시간도 아이에게는 충분한 연결의 경험이에요.',
        totalMissionDurationSeconds: 4620,
        childPositiveReactionRate: 0.92,
        psychologicalEnergy: 75,
        aiActionSuggestion: '내일 아침 5분 등굣길 대화를 시도해보세요.',
        generatedAt: new Date('2026-05-11T00:05:00+09:00'),
        days: [
          { weekday: 'mon', completedCount: 1 },
          { weekday: 'tue', completedCount: 0 },
          { weekday: 'wed', completedCount: 0 },
          { weekday: 'thu', completedCount: 0 },
          { weekday: 'fri', completedCount: 0 },
          { weekday: 'sat', completedCount: 0 },
          { weekday: 'sun', completedCount: 0 },
        ],
        topKeywords: [
          { rank: 1, keyword: '공룡' },
          { rank: 2, keyword: '우주' },
        ],
        bestMoments: [
          {
            id: 'moment-1',
            order: 1,
            label: '순수한 기쁨',
            title: '10분 눈마주치면서 웃기',
            body: '서로의 존재가 맞닿는 고요함 속에서 이루어진 순간',
          },
        ],
        improvementTips: [],
      },
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.getCurrent('user-1', {
      today: new Date('2026-05-13T12:00:00+09:00'),
    });

    assert.equal(result.selectedChild.id, 'child-1');
    assert.equal(result.report?.id, 'report-1');
    assert.equal(result.report?.weekStart, '2026-05-04');
    assert.equal(
      result.report?.missionSummary.totalDurationLabel,
      '1시간 17분',
    );
    assert.equal(result.report?.missionSummary.childPositiveReactionRate, 92);
    assert.deepEqual(
      result.report?.missionSummary.days.map(
        (day: { weekday: string; label: string; completed: boolean }) => [
          day.weekday,
          day.label,
          day.completed,
        ],
      ),
      [
        ['mon', '월', true],
        ['tue', '화', false],
        ['wed', '수', false],
        ['thu', '목', false],
        ['fri', '금', false],
        ['sat', '토', false],
        ['sun', '일', false],
      ],
    );
    assert.equal(result.report?.keywordEmptyState, null);
    assert.equal(result.emptyState, null);
  });

  void it('returns an empty state when the child has never completed a mission', async () => {
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
      report: null,
      completedMissionCount: 0,
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.getCurrent('user-1', {
      today: new Date('2026-05-13T12:00:00+09:00'),
    });

    assert.equal(result.report, null);
    assert.equal(result.emptyState?.reason, 'no_mission_yet');
    assert.equal(result.emptyState?.title, '아직 주간 리포트가 없습니다');
  });

  void it('returns pending when the target week has missions but no report yet', async () => {
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
      report: null,
      completedMissionCounts: [1, 1],
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.getCurrent('user-1', {
      today: new Date('2026-05-11T00:03:00+09:00'),
    });

    assert.equal(result.report, null);
    assert.equal(result.emptyState?.reason, 'report_generation_pending');
    assert.equal(result.emptyState?.title, '리포트를 준비 중이에요');
  });

  void it('keeps the report visible and returns keyword empty copy when feedback keywords are absent', async () => {
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
      report: {
        id: 'report-1',
        weekStart: new Date('2026-05-04T00:00:00+09:00'),
        weekEnd: new Date('2026-05-10T00:00:00+09:00'),
        headline: '지금 충분히 잘하고 계십니다.',
        headlineBody: null,
        totalMissionDurationSeconds: 600,
        childPositiveReactionRate: 0,
        psychologicalEnergy: 50,
        aiActionSuggestion: '다음 미션 후 아이가 자주 말한 단어를 남겨보세요.',
        generatedAt: new Date('2026-05-11T00:05:00+09:00'),
        days: [],
        topKeywords: [],
        bestMoments: [],
      },
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.getCurrent('user-1', {
      today: new Date('2026-05-13T12:00:00+09:00'),
    });

    assert.deepEqual(result.report?.topKeywords, []);
    assert.equal(
      result.report?.keywordEmptyState?.title,
      '아직 키워드가 충분하지 않아요',
    );
    assert.equal(result.emptyState, null);
  });

  void it('throws WEEKLY_REPORT_NOT_FOUND when a report id is not owned by the user', async () => {
    const prisma = createPrismaStub({
      children: [],
      report: null,
    });
    const service = new WeeklyReportsService(prisma);

    await assert.rejects(() => service.getById('user-1', 'report-1'), {
      response: {
        code: 'WEEKLY_REPORT_NOT_FOUND',
        message: 'Weekly report not found.',
      },
    });
  });

  void it('generates a weekly report draft from completed missions and normalized keywords', async () => {
    const createCalls: unknown[] = [];
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
      report: null,
      executions: [
        {
          id: 'execution-1',
          userId: 'user-1',
          childId: 'child-1',
          missionId: 'mission-1',
          status: 'completed',
          completedAt: new Date('2026-05-04T10:00:00+09:00'),
          actualDurationSeconds: 600,
          mission: { durationMinutes: 10 },
          feedback: {
            childReaction: 5,
            parentEnergy: 4,
            keywords: [
              { keyword: ' Dino ' },
              { keyword: 'dino' },
              { keyword: '공룡' },
            ],
          },
        },
      ],
      onCreateReport: (args) => createCalls.push(args),
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.generateForWeek({
      weekStart: '2026-05-04',
    });

    assert.deepEqual(result, {
      processed: 1,
      generated: 1,
      skipped: 0,
    });
    assert.equal(createCalls.length, 1);

    const createData = createCalls[0] as {
      data: {
        topKeywords: { create: Array<{ rank: number; keyword: string }> };
      };
    };
    assert.deepEqual(createData.data.topKeywords.create, [
      { rank: 1, keyword: 'Dino' },
      { rank: 2, keyword: '공룡' },
    ]);
  });

  void it('skips weekly report generation when a child has no completed missions for the week', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      children: [createChild()],
      report: null,
      executions: [],
      onCreateReport: (args) => createCalls.push(args),
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.generateForWeek({
      weekStart: '2026-05-04',
    });

    assert.deepEqual(result, {
      processed: 1,
      generated: 0,
      skipped: 1,
    });
    assert.equal(createCalls.length, 0);
  });

  void it('creates a report with empty top keywords when feedback keywords are absent', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      children: [createChild()],
      report: null,
      executions: [
        {
          id: 'execution-1',
          userId: 'user-1',
          childId: 'child-1',
          missionId: 'mission-1',
          status: 'completed',
          completedAt: new Date('2026-05-04T10:00:00+09:00'),
          actualDurationSeconds: 600,
          mission: { durationMinutes: 10 },
          feedback: {
            childReaction: 5,
            parentEnergy: 4,
            keywords: [],
          },
        },
      ],
      onCreateReport: (args) => createCalls.push(args),
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.generateForWeek({
      weekStart: '2026-05-04',
    });

    assert.equal(result.generated, 1);
    const createData = createCalls[0] as {
      data: {
        topKeywords: { create: Array<{ rank: number; keyword: string }> };
      };
    };
    assert.deepEqual(createData.data.topKeywords.create, []);
  });

  void it('uses weekly mental battery checks before parent energy fallback', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      children: [createChild()],
      report: null,
      executions: [
        {
          id: 'execution-1',
          userId: 'user-1',
          childId: 'child-1',
          missionId: 'mission-1',
          status: 'completed',
          completedAt: new Date('2026-05-04T10:00:00+09:00'),
          actualDurationSeconds: 600,
          mission: { durationMinutes: 10 },
          feedback: {
            childReaction: 5,
            parentEnergy: 1,
            keywords: [],
          },
        },
      ],
      mentalBatteryChecks: [{ level: 2 }, { level: 5 }],
      onCreateReport: (args) => createCalls.push(args),
    });
    const service = new WeeklyReportsService(prisma);

    await service.generateForWeek({
      weekStart: '2026-05-04',
    });

    const createData = createCalls[0] as {
      data: {
        psychologicalEnergy: number;
      };
    };
    assert.equal(createData.data.psychologicalEnergy, 70);
  });

  void it('skips an existing report during regular generation', async () => {
    const createCalls: unknown[] = [];
    const prisma = createPrismaStub({
      children: [createChild()],
      report: createReport(),
      executions: [
        {
          id: 'execution-1',
          userId: 'user-1',
          childId: 'child-1',
          missionId: 'mission-1',
          status: 'completed',
          completedAt: new Date('2026-05-04T10:00:00+09:00'),
          actualDurationSeconds: 600,
          mission: { durationMinutes: 10 },
          feedback: null,
        },
      ],
      onCreateReport: (args) => createCalls.push(args),
    });
    const service = new WeeklyReportsService(prisma);

    const result = await service.generateForWeek({
      weekStart: '2026-05-04',
    });

    assert.deepEqual(result, {
      processed: 1,
      generated: 0,
      skipped: 1,
    });
    assert.equal(createCalls.length, 0);
  });
});

function createChild() {
  return {
    id: 'child-1',
    userId: 'user-1',
    name: '김유스',
    birthDate: new Date('2023-04-20T00:00:00+09:00'),
    displayOrder: 0,
    createdAt: new Date('2026-05-01T00:00:00+09:00'),
  };
}

function createReport() {
  return {
    id: 'report-1',
    userId: 'user-1',
    childId: 'child-1',
    weekStart: new Date('2026-05-04T00:00:00+09:00'),
    weekEnd: new Date('2026-05-10T00:00:00+09:00'),
    headline: '지금 충분히 잘하고 계십니다.',
    headlineBody: '짧은 시간도 아이에게는 충분한 연결의 경험이에요.',
    totalMissionDurationSeconds: 600,
    childPositiveReactionRate: 0.5,
    psychologicalEnergy: 50,
    aiActionSuggestion: '다음 미션을 이어가보세요.',
    generatedAt: new Date('2026-05-11T00:05:00+09:00'),
    days: [],
    topKeywords: [],
    bestMoments: [],
  };
}

function createPrismaStub({
  children,
  report,
  completedMissionCount = 1,
  completedMissionCounts,
  executions = [],
  mentalBatteryChecks = [],
  onCreateReport,
}: {
  children: Awaited<ReturnType<WeeklyReportsPrisma['child']['findMany']>>;
  report: Awaited<ReturnType<WeeklyReportsPrisma['weeklyReport']['findFirst']>>;
  completedMissionCount?: number;
  completedMissionCounts?: number[];
  executions?: unknown[];
  mentalBatteryChecks?: Array<{ level: number }>;
  onCreateReport?: (args: unknown) => void;
}): WeeklyReportsPrisma {
  let countCallIndex = 0;
  return {
    child: {
      findMany: () => Promise.resolve(children),
    },
    weeklyReport: {
      findFirst: () => Promise.resolve(report),
      delete: () => Promise.resolve(undefined),
      create: (args: unknown) => {
        onCreateReport?.(args);
        return Promise.resolve(args);
      },
    },
    missionExecution: {
      count: () =>
        Promise.resolve(
          completedMissionCounts?.[countCallIndex++] ?? completedMissionCount,
        ),
      findMany: () => Promise.resolve(executions),
    },
    mentalBatteryCheck: {
      findMany: () => Promise.resolve(mentalBatteryChecks),
    },
    notification: {
      create: () => Promise.resolve(undefined),
    },
  };
}
