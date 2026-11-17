import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaService } from '../../prisma/prisma.service';
import { applyExecutionAction } from './execution-actions';

const createPrisma = () => {
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    missionExecution: {
      update: ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaService;
  return { prisma, updates };
};

const now = new Date('2026-11-17T10:00:00+09:00');
const justStarted = {
  id: 'execution-1',
  status: 'in_progress' as const,
  activeSegmentStartedAt: new Date(now.getTime() - 1000),
  elapsedSeconds: 0,
  mission: { durationMinutes: 10 },
};

void describe('applyExecutionAction complete', () => {
  void it('uses the client elapsed time when completing without a timer', async () => {
    const { prisma, updates } = createPrisma();
    await applyExecutionAction(prisma, justStarted, 'complete', now, 245);
    assert.equal(updates[0].actualDurationSeconds, 245);
  });

  void it('keeps the server time when it is longer than the client time', async () => {
    const { prisma, updates } = createPrisma();
    const paused = {
      ...justStarted,
      status: 'paused' as const,
      activeSegmentStartedAt: null,
      elapsedSeconds: 300,
    };
    await applyExecutionAction(prisma, paused, 'complete', now, 120);
    assert.equal(updates[0].actualDurationSeconds, 300);
  });

  void it('caps the client elapsed time at the mission duration', async () => {
    const { prisma, updates } = createPrisma();
    await applyExecutionAction(prisma, justStarted, 'complete', now, 5000);
    assert.equal(updates[0].actualDurationSeconds, 600);
  });

  void it('falls back to the server time without a client value', async () => {
    const { prisma, updates } = createPrisma();
    await applyExecutionAction(prisma, justStarted, 'complete', now);
    assert.equal(updates[0].actualDurationSeconds, 1);
  });
});
