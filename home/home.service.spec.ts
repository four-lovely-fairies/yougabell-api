import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HomeService } from './home.service';

void describe('HomeService', () => {
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
  existingCheck: {
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
    mentalBatteryCheck: {
      findFirst: () => Promise.resolve(options.existingCheck),
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
