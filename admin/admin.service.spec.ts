import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminService } from './admin.service';

void describe('AdminService', () => {
  void it('runs weekly report generation with the requested week and force flag', async () => {
    const calls: unknown[] = [];
    const service = new AdminService(
      createPrismaStub() as unknown as ConstructorParameters<
        typeof AdminService
      >[0],
      {
        generateForWeek: (input: unknown) => {
          calls.push(input);
          return Promise.resolve({
            processed: 2,
            generated: 1,
            skipped: 1,
          });
        },
      } as unknown as ConstructorParameters<typeof AdminService>[1],
    );

    const result = await service.generateWeeklyReports({
      weekStart: '2026-05-04',
      forceRegenerate: true,
    });

    assert.deepEqual(calls, [
      { weekStart: '2026-05-04', forceRegenerate: true },
    ]);
    assert.deepEqual(result, {
      processed: 2,
      generated: 1,
      skipped: 1,
    });
  });
});

function createPrismaStub() {
  return {
    $transaction: () => Promise.resolve([]),
    user: {
      findMany: () => Promise.resolve([]),
      count: () => Promise.resolve(0),
    },
  };
}
