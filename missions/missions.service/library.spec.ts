import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaService } from '../../prisma/prisma.service';
import {
  listFavoriteMissions,
  listMissionHistory,
  setFavoriteMission,
} from './library';

const mission = {
  id: 'mission-1',
  title: '짝짜꿍 노래 게임',
  shortTitle: '손뼉을 마주치며 노래를 3번 반복해요',
  description: '아이와 마주 앉아 손뼉을 마주친다.',
  durationMinutes: 10,
  categoryId: 'language',
  category: { label: '언어발달' },
};

type Calls = Record<string, unknown[]>;

const createPrisma = (data: {
  favorites?: unknown[];
  executions?: unknown[];
  missionExists?: boolean;
}) => {
  const calls: Calls = {};
  const record = (name: string, value: unknown) => (args?: unknown) => {
    (calls[name] ??= []).push(args);
    return Promise.resolve(value);
  };
  const prisma = {
    mission: {
      findUnique: record(
        'mission.findUnique',
        data.missionExists === false ? null : { id: mission.id },
      ),
    },
    favoriteMission: {
      findMany: record('favorite.findMany', data.favorites ?? []),
      count: record('favorite.count', (data.favorites ?? []).length),
      upsert: record('favorite.upsert', {}),
      deleteMany: record('favorite.deleteMany', { count: 1 }),
    },
    missionExecution: {
      findMany: record('execution.findMany', data.executions ?? []),
      count: record('execution.count', (data.executions ?? []).length),
    },
  } as unknown as PrismaService;
  return { prisma, calls };
};

void describe('favorite missions', () => {
  void it('lists saved missions newest first by default', async () => {
    const savedAt = new Date('2026-11-17T10:00:00+09:00');
    const { prisma, calls } = createPrisma({
      favorites: [{ createdAt: savedAt, mission }],
    });
    const result = await listFavoriteMissions(prisma, 'user-1', {});
    const args = calls['favorite.findMany'][0] as {
      orderBy: { createdAt: string };
    };
    assert.equal(args.orderBy.createdAt, 'desc');
    assert.equal(result.total, 1);
    assert.deepEqual(result.items[0], {
      missionId: 'mission-1',
      title: mission.title,
      shortTitle: mission.shortTitle,
      description: mission.description,
      durationMinutes: 10,
      durationLabel: '10분',
      categoryId: 'language',
      categoryLabel: '언어발달',
      isFavorite: true,
      savedAt: savedAt.toISOString(),
    });
  });

  void it('applies oldest order, title search and category filter', async () => {
    const { prisma, calls } = createPrisma({});
    await listFavoriteMissions(prisma, 'user-1', {
      order: 'oldest',
      q: ' 노래 ',
      categoryId: 'language',
    });
    const args = calls['favorite.findMany'][0] as {
      where: { mission: { title: { contains: string }; categoryId: string } };
      orderBy: { createdAt: string };
    };
    assert.equal(args.orderBy.createdAt, 'asc');
    assert.equal(args.where.mission.title.contains, '노래');
    assert.equal(args.where.mission.categoryId, 'language');
  });

  void it('saves and removes a favorite', async () => {
    const { prisma, calls } = createPrisma({});
    assert.deepEqual(
      await setFavoriteMission(prisma, 'user-1', 'mission-1', true),
      { missionId: 'mission-1', isFavorite: true },
    );
    assert.equal(calls['favorite.upsert'].length, 1);
    assert.deepEqual(
      await setFavoriteMission(prisma, 'user-1', 'mission-1', false),
      { missionId: 'mission-1', isFavorite: false },
    );
    assert.equal(calls['favorite.deleteMany'].length, 1);
  });

  void it('rejects saving a mission that does not exist', async () => {
    const { prisma } = createPrisma({ missionExists: false });
    await assert.rejects(
      setFavoriteMission(prisma, 'user-1', 'missing', true),
      /Mission not found/,
    );
  });
});

void describe('mission history', () => {
  void it('lists completed plays with favorite and feedback flags', async () => {
    const completedAt = new Date('2026-11-17T10:05:00+09:00');
    const { prisma, calls } = createPrisma({
      executions: [
        {
          id: 'execution-1',
          childId: 'child-1',
          status: 'completed',
          completedAt,
          actualDurationSeconds: 420,
          feedback: null,
          mission,
        },
      ],
      favorites: [{ missionId: 'mission-1' }],
    });
    const result = await listMissionHistory(prisma, 'user-1', {
      childId: 'child-1',
    });
    const args = calls['execution.findMany'][0] as {
      where: { childId: string };
      orderBy: { completedAt: string };
    };
    assert.equal(args.where.childId, 'child-1');
    assert.equal(args.orderBy.completedAt, 'desc');
    assert.equal(result.items[0].executionId, 'execution-1');
    assert.equal(result.items[0].completedAt, completedAt.toISOString());
    assert.equal(result.items[0].actualDurationSeconds, 420);
    assert.equal(result.items[0].isFavorite, true);
    assert.equal(result.items[0].hasFeedback, false);
  });
});
