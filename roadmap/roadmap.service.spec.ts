import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RoadmapService } from './roadmap.service';

type PrismaArg = ConstructorParameters<typeof RoadmapService>[0];

void describe('RoadmapService milestone completion', () => {
  void it('자녀의 발달 지표를 체크하고 체크 시각을 반환한다', async () => {
    const completedAt = new Date('2026-09-01T09:00:00.000Z');
    const upserts: unknown[] = [];
    const service = new RoadmapService(
      createPrismaStub({ completedAt, upserts }) as unknown as PrismaArg,
    );

    const result = await service.setMilestoneCompletion(
      'user-1',
      'milestone-1',
      { childId: 'child-1', completed: true },
    );

    assert.deepEqual(result, {
      milestoneId: 'milestone-1',
      completed: true,
      completedAt: completedAt.toISOString(),
    });
    assert.equal(upserts.length, 1);
  });

  void it('체크를 해제하면 저장된 완료 행을 삭제한다', async () => {
    const deletes: unknown[] = [];
    const service = new RoadmapService(
      createPrismaStub({ deletes }) as unknown as PrismaArg,
    );

    const result = await service.setMilestoneCompletion(
      'user-1',
      'milestone-1',
      { childId: 'child-1', completed: false },
    );

    assert.deepEqual(result, {
      milestoneId: 'milestone-1',
      completed: false,
      completedAt: null,
    });
    assert.equal(deletes.length, 1);
  });

  void it('사용자 소유가 아닌 자녀의 체크 상태는 변경하지 않는다', async () => {
    const service = new RoadmapService(
      createPrismaStub({ child: null }) as unknown as PrismaArg,
    );

    await assert.rejects(
      () =>
        service.setMilestoneCompletion('user-1', 'milestone-1', {
          childId: 'other-child',
          completed: true,
        }),
      (error: unknown) => {
        const response = (error as { response?: { code?: string } }).response;
        assert.equal(response?.code, 'CHILD_NOT_FOUND');
        return true;
      },
    );
  });
});

function createPrismaStub(options: {
  child?: { id: string } | null;
  milestone?: { id: string } | null;
  completedAt?: Date;
  upserts?: unknown[];
  deletes?: unknown[];
}) {
  return {
    child: {
      findFirst: () =>
        Promise.resolve(
          options.child === undefined ? { id: 'child-1' } : options.child,
        ),
    },
    milestone: {
      findUnique: () =>
        Promise.resolve(
          options.milestone === undefined
            ? { id: 'milestone-1' }
            : options.milestone,
        ),
    },
    childMilestoneCompletion: {
      upsert: (args: unknown) => {
        options.upserts?.push(args);
        return Promise.resolve({
          completedAt:
            options.completedAt ?? new Date('2026-09-01T09:00:00.000Z'),
        });
      },
      deleteMany: (args: unknown) => {
        options.deletes?.push(args);
        return Promise.resolve({ count: 1 });
      },
    },
  };
}
