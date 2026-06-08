import { MissionExecutionStatus } from '@prisma/client';
import { MissionExecutionSnapshotDto } from '../dto/mission-flow.dto';
import { CurrentMissionStatus } from './selects';

export function getCurrentElapsedSeconds(
  execution: {
    elapsedSeconds: number;
    status: MissionExecutionStatus;
    activeSegmentStartedAt: Date | null;
  },
  now: Date,
) {
  if (execution.status !== 'in_progress' || !execution.activeSegmentStartedAt) {
    return execution.elapsedSeconds;
  }

  const segmentSeconds = Math.max(
    0,
    Math.floor(
      (now.getTime() - execution.activeSegmentStartedAt.getTime()) / 1000,
    ),
  );
  return execution.elapsedSeconds + segmentSeconds;
}

export function toActiveExecution(
  execution: {
    id: string;
    status: MissionExecutionStatus;
    startedAt: Date;
    activeSegmentStartedAt: Date | null;
    pausedAt: Date | null;
    elapsedSeconds: number;
    mission: {
      durationMinutes: number;
    };
  },
  serverNow: Date,
) {
  return {
    id: execution.id,
    status: execution.status as 'in_progress' | 'paused',
    startedAt: execution.startedAt.toISOString(),
    activeSegmentStartedAt:
      execution.activeSegmentStartedAt?.toISOString() ?? null,
    pausedAt: execution.pausedAt?.toISOString() ?? null,
    durationMinutes: execution.mission.durationMinutes,
    elapsedSeconds: execution.elapsedSeconds,
    remainingSeconds: getRemainingSeconds(execution, serverNow),
  };
}

export function toMissionExecutionSnapshot(
  execution: {
    id: string;
    childId: string;
    missionId: string;
    status: MissionExecutionStatus;
    startedAt: Date;
    activeSegmentStartedAt: Date | null;
    pausedAt: Date | null;
    elapsedSeconds: number;
    mission: {
      durationMinutes: number;
    };
  },
  serverNow: Date,
): MissionExecutionSnapshotDto {
  return {
    ...toActiveExecution(execution, serverNow),
    missionId: execution.missionId,
    childId: execution.childId,
    serverNow: serverNow.toISOString(),
  };
}

export function toCurrentMissionStatus(
  status: MissionExecutionStatus,
): CurrentMissionStatus {
  if (status === 'completed' || status === 'early_completed') {
    return 'completed';
  }
  if (status === 'in_progress' || status === 'paused') {
    return 'in_progress';
  }
  return 'not_started';
}

function getRemainingSeconds(
  execution: {
    elapsedSeconds: number;
    status: MissionExecutionStatus;
    activeSegmentStartedAt: Date | null;
    mission: {
      durationMinutes: number;
    };
  },
  now: Date,
) {
  const totalSeconds = execution.mission.durationMinutes * 60;
  return Math.max(0, totalSeconds - getCurrentElapsedSeconds(execution, now));
}
