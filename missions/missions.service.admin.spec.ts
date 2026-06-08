import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MissionsService } from './missions.service';
import { createPrismaStub } from './missions.service.stub';

void describe('MissionsService (admin)', () => {
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
});
