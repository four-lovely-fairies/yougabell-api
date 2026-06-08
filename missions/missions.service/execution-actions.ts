import { BadRequestException } from '@nestjs/common';
import { MissionExecutionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionExecutionSnapshotDto } from '../dto/mission-flow.dto';
import {
  getCurrentElapsedSeconds,
  toMissionExecutionSnapshot,
} from './execution.utils';
import { ACTIVE_EXECUTION_SELECT } from './selects';

export type MissionExecutionAction =
  | 'pause'
  | 'resume'
  | 'complete'
  | 'early_complete';

type ExecutionForAction = {
  id: string;
  status: MissionExecutionStatus;
  activeSegmentStartedAt: Date | null;
  elapsedSeconds: number;
  mission: { durationMinutes: number };
};

type ActionResult = { execution: MissionExecutionSnapshotDto | null };

export async function applyExecutionAction(
  prisma: PrismaService,
  execution: ExecutionForAction,
  action: MissionExecutionAction,
  now: Date,
): Promise<ActionResult> {
  const totalElapsedSeconds = getCurrentElapsedSeconds(execution, now);

  if (action === 'pause') {
    return pauseExecution(prisma, execution, now, totalElapsedSeconds);
  }
  if (action === 'resume') {
    return resumeExecution(prisma, execution, now);
  }
  if (action === 'complete') {
    return completeExecution(prisma, execution, now, totalElapsedSeconds);
  }
  return earlyCompleteExecution(prisma, execution, now, totalElapsedSeconds);
}

async function pauseExecution(
  prisma: PrismaService,
  execution: ExecutionForAction,
  now: Date,
  totalElapsedSeconds: number,
): Promise<ActionResult> {
  if (execution.status !== 'in_progress' || !execution.activeSegmentStartedAt) {
    throw new BadRequestException({
      code: 'MISSION_EXECUTION_ACTION_INVALID',
      message: 'Mission execution cannot be paused.',
    });
  }

  const updated = await prisma.missionExecution.update({
    where: { id: execution.id },
    data: {
      status: 'paused',
      elapsedSeconds: totalElapsedSeconds,
      activeSegmentStartedAt: null,
      pausedAt: now,
    },
    select: ACTIVE_EXECUTION_SELECT,
  });
  return { execution: toMissionExecutionSnapshot(updated, now) };
}

async function resumeExecution(
  prisma: PrismaService,
  execution: ExecutionForAction,
  now: Date,
): Promise<ActionResult> {
  if (execution.status !== 'paused') {
    throw new BadRequestException({
      code: 'MISSION_EXECUTION_ACTION_INVALID',
      message: 'Mission execution cannot be resumed.',
    });
  }

  const updated = await prisma.missionExecution.update({
    where: { id: execution.id },
    data: {
      status: 'in_progress',
      activeSegmentStartedAt: now,
      pausedAt: null,
    },
    select: ACTIVE_EXECUTION_SELECT,
  });
  return { execution: toMissionExecutionSnapshot(updated, now) };
}

async function completeExecution(
  prisma: PrismaService,
  execution: ExecutionForAction,
  now: Date,
  totalElapsedSeconds: number,
): Promise<ActionResult> {
  if (execution.status !== 'in_progress' && execution.status !== 'paused') {
    throw new BadRequestException({
      code: 'MISSION_EXECUTION_ACTION_INVALID',
      message: 'Mission execution cannot be completed.',
    });
  }

  const cappedSeconds = Math.min(
    execution.mission.durationMinutes * 60,
    totalElapsedSeconds,
  );
  await prisma.missionExecution.update({
    where: { id: execution.id },
    data: {
      status: 'completed',
      completedAt: now,
      actualDurationSeconds: cappedSeconds,
      elapsedSeconds: cappedSeconds,
      activeSegmentStartedAt: null,
      pausedAt: null,
      wasEarlyCompleted: false,
    },
  });
  return { execution: null };
}

async function earlyCompleteExecution(
  prisma: PrismaService,
  execution: ExecutionForAction,
  now: Date,
  totalElapsedSeconds: number,
): Promise<ActionResult> {
  if (execution.status !== 'in_progress' && execution.status !== 'paused') {
    throw new BadRequestException({
      code: 'MISSION_EXECUTION_ACTION_INVALID',
      message: 'Mission execution cannot be early completed.',
    });
  }

  await prisma.missionExecution.update({
    where: { id: execution.id },
    data: {
      status: 'early_completed',
      completedAt: now,
      actualDurationSeconds: totalElapsedSeconds,
      elapsedSeconds: totalElapsedSeconds,
      activeSegmentStartedAt: null,
      pausedAt: null,
      wasEarlyCompleted: true,
    },
  });
  return { execution: null };
}
