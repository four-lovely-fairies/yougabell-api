import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { MissionsService } from './missions.service';

void describe('MissionsService.resetTodayMissionExecution', () => {
  void it("deletes today's executions for the child and returns the count", async () => {
    const deleteCalls: Array<{ where?: Record<string, unknown> }> = [];
    const service = new MissionsService({
      child: {
        findFirst: () => Promise.resolve({ id: 'child-1', userId: 'user-1' }),
      },
      missionExecution: {
        deleteMany: (args: { where?: Record<string, unknown> }) => {
          deleteCalls.push(args);
          return Promise.resolve({ count: 2 });
        },
      },
    } as never);

    const result = await service.resetTodayMissionExecution(
      'user-1',
      'child-1',
    );

    assert.deepEqual(result, { deletedCount: 2 });
    const where = deleteCalls[0]?.where as {
      userId: string;
      childId: string;
      startedAt: { gte: Date; lte: Date };
    };
    assert.equal(where.userId, 'user-1');
    assert.equal(where.childId, 'child-1');
    assert.equal(where.startedAt.gte instanceof Date, true);
    assert.equal(where.startedAt.lte instanceof Date, true);
    assert.equal(
      where.startedAt.gte.getTime() < where.startedAt.lte.getTime(),
      true,
    );
  });

  void it('throws when the child does not belong to the user', async () => {
    const service = new MissionsService({
      child: { findFirst: () => Promise.resolve(null) },
      missionExecution: {
        deleteMany: () => Promise.reject(new Error('should not be called')),
      },
    } as never);

    await assert.rejects(
      () => service.resetTodayMissionExecution('user-1', 'child-x'),
      NotFoundException,
    );
  });
});
