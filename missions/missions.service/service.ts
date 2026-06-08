import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  getAgeLabel,
  getAgeMonths,
  toDateOnly,
} from '../../home/home-date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetActiveMissionExecutionQueryDto,
  GetCurrentMissionQueryDto,
  StartMissionExecutionDto,
  UpsertMissionFeedbackDto,
} from '../dto/mission-flow.dto';
import {
  CreateMissionDto,
  ListMissionsQueryDto,
  UpdateMissionDto,
} from '../dto/mission.dto';
import {
  createMission,
  listMissions,
  removeMission,
  updateMission,
} from './admin';
import {
  applyExecutionAction,
  MissionExecutionAction,
} from './execution-actions';
import {
  toActiveExecution,
  toMissionExecutionSnapshot,
} from './execution.utils';
import {
  buildFeedbackKeywordRows,
  normalizeFeedbackNote,
  toMissionFeedbackResponse,
} from './feedback.utils';
import { findCurrentMission } from './recommendation';
import {
  ACTIVE_EXECUTION_SELECT,
  ACTIVE_MISSION_STATUSES,
  ActiveExecutionRow,
  EFFECT_EXECUTION_SELECT,
  FEEDBACK_EXECUTION_SELECT,
  FEEDBACK_SELECT,
} from './selects';

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMissionsQueryDto) {
    return listMissions(this.prisma, query);
  }

  async create(dto: CreateMissionDto) {
    return createMission(this.prisma, dto);
  }

  async update(id: string, dto: UpdateMissionDto) {
    return updateMission(this.prisma, id, dto);
  }

  async remove(id: string) {
    await removeMission(this.prisma, id);
  }

  async getCurrentMission(userId: string, query: GetCurrentMissionQueryDto) {
    const today = new Date();
    const children = await this.prisma.child.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (children.length === 0) {
      throw new ConflictException({
        code: 'NO_CHILD_PROFILE',
        message: 'No active child profile exists.',
      });
    }

    const selectedChild = query.childId
      ? children.find((child) => child.id === query.childId)
      : children[0];

    if (!selectedChild) {
      throw new NotFoundException({
        code: 'CHILD_NOT_FOUND',
        message: 'Child not found.',
      });
    }

    const ageMonths = getAgeMonths(selectedChild.birthDate, today);
    const [currentMission, activeExecution] = await Promise.all([
      findCurrentMission(this.prisma, selectedChild.id, ageMonths, today),
      this.findActiveExecution(userId, selectedChild.id),
    ]);

    if (!currentMission) {
      throw new NotFoundException({
        code: 'CURRENT_MISSION_NOT_FOUND',
        message: 'Current mission not found.',
      });
    }

    return {
      selectedChild: toChildSummary(selectedChild, today),
      children: children.map((child) => toChildSummary(child, today)),
      mission: {
        id: currentMission.mission.id,
        subThemeLabel: currentMission.mission.subThemeLabel,
        title: currentMission.mission.title,
        description: currentMission.mission.description,
        durationMinutes: currentMission.mission.durationMinutes,
        durationLabel: `${currentMission.mission.durationMinutes}분`,
        categoryLabel: currentMission.mission.category.label,
        sourceLabel: currentMission.mission.sources[0]?.citation ?? '출처 없음',
        status: currentMission.status,
      },
      activeExecution: activeExecution
        ? toActiveExecution(activeExecution, new Date())
        : null,
    };
  }

  async startMissionExecution(userId: string, dto: StartMissionExecutionDto) {
    const [child, mission, existingExecution] = await Promise.all([
      this.assertActiveChild(userId, dto.childId),
      this.prisma.mission.findUnique({
        where: { id: dto.missionId },
      }),
      this.findActiveExecution(userId, dto.childId),
    ]);

    if (!mission) {
      throw new NotFoundException({
        code: 'MISSION_NOT_FOUND',
        message: 'Mission not found.',
      });
    }

    void child;

    if (existingExecution) {
      return {
        execution: toMissionExecutionSnapshot(existingExecution, new Date()),
      };
    }

    const now = new Date();
    const created = await this.prisma.missionExecution.create({
      data: {
        userId,
        childId: dto.childId,
        missionId: dto.missionId,
        status: 'in_progress',
        startedAt: now,
        activeSegmentStartedAt: now,
        elapsedSeconds: 0,
        pausedAt: null,
        wasEarlyCompleted: false,
      },
      select: ACTIVE_EXECUTION_SELECT,
    });

    return {
      execution: toMissionExecutionSnapshot(created, now),
    };
  }

  async getActiveMissionExecution(
    userId: string,
    query: GetActiveMissionExecutionQueryDto,
  ) {
    if (query.childId) {
      await this.assertActiveChild(userId, query.childId);
    }

    const execution = query.childId
      ? await this.findActiveExecution(userId, query.childId)
      : await this.findDefaultActiveExecution(userId);

    const serverNow = new Date();
    return {
      execution: execution
        ? toMissionExecutionSnapshot(execution, serverNow)
        : null,
    };
  }

  async applyMissionExecutionAction(
    userId: string,
    executionId: string,
    action: MissionExecutionAction,
  ) {
    const execution = await this.prisma.missionExecution.findFirst({
      where: {
        id: executionId,
        userId,
      },
      include: {
        mission: { select: { durationMinutes: true } },
        child: true,
      },
    });

    if (!execution || execution.child.deletedAt) {
      throw new NotFoundException({
        code: 'MISSION_EXECUTION_NOT_FOUND',
        message: 'Mission execution not found.',
      });
    }

    return applyExecutionAction(this.prisma, execution, action, new Date());
  }

  async getMissionExecutionEffect(userId: string, executionId: string) {
    const execution = await this.prisma.missionExecution.findFirst({
      where: {
        id: executionId,
        userId,
      },
      select: EFFECT_EXECUTION_SELECT,
    });

    if (!execution || execution.child.deletedAt) {
      throw new NotFoundException({
        code: 'MISSION_EXECUTION_NOT_FOUND',
        message: 'Mission execution not found.',
      });
    }

    if (
      execution.status !== 'completed' &&
      execution.status !== 'early_completed'
    ) {
      throw new ConflictException({
        code: 'MISSION_EXECUTION_NOT_FINISHED',
        message: 'Mission execution is not finished.',
      });
    }

    if (!execution.completedAt || execution.actualDurationSeconds === null) {
      throw new ConflictException({
        code: 'MISSION_EXECUTION_NOT_FINISHED',
        message: 'Mission execution is not finished.',
      });
    }

    return {
      execution: {
        id: execution.id,
        status: execution.status,
        completedAt: execution.completedAt.toISOString(),
        actualDurationSeconds: execution.actualDurationSeconds,
        wasEarlyCompleted: execution.wasEarlyCompleted,
      },
      mission: {
        id: execution.mission.id,
        title: execution.mission.title,
        effect: execution.mission.effect,
        goal: execution.mission.goal,
        subThemeLabel: execution.mission.subThemeLabel,
      },
    };
  }

  async upsertMissionFeedback(
    userId: string,
    executionId: string,
    dto: UpsertMissionFeedbackDto,
  ) {
    const execution = await this.prisma.missionExecution.findFirst({
      where: {
        id: executionId,
        userId,
      },
      select: FEEDBACK_EXECUTION_SELECT,
    });

    if (!execution || execution.child.deletedAt) {
      throw new NotFoundException({
        code: 'MISSION_EXECUTION_NOT_FOUND',
        message: 'Mission execution not found.',
      });
    }

    if (
      execution.status !== 'completed' &&
      execution.status !== 'early_completed'
    ) {
      throw new ConflictException({
        code: 'MISSION_EXECUTION_NOT_FINISHED',
        message: 'Mission execution is not finished.',
      });
    }

    const keywordRows = buildFeedbackKeywordRows(dto.note ?? null);

    const feedback = await this.prisma.missionFeedback.upsert({
      where: { executionId },
      create: {
        executionId,
        childReaction: dto.childReaction,
        parentEnergy: dto.parentEnergy,
        missionSatisfaction: dto.missionSatisfaction,
        note: normalizeFeedbackNote(dto.note),
        keywords: keywordRows.length
          ? { createMany: { data: keywordRows } }
          : undefined,
      },
      update: {
        childReaction: dto.childReaction,
        parentEnergy: dto.parentEnergy,
        missionSatisfaction: dto.missionSatisfaction,
        note: normalizeFeedbackNote(dto.note),
        keywords: {
          deleteMany: {},
          ...(keywordRows.length ? { createMany: { data: keywordRows } } : {}),
        },
      },
      select: FEEDBACK_SELECT,
    });

    return {
      feedback: toMissionFeedbackResponse(feedback),
    };
  }

  private async assertActiveChild(userId: string, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        userId,
        deletedAt: null,
      },
    });

    if (!child) {
      throw new NotFoundException({
        code: 'CHILD_NOT_FOUND',
        message: 'Child not found.',
      });
    }

    return child;
  }

  private async findActiveExecution(
    userId: string,
    childId: string,
  ): Promise<ActiveExecutionRow | null> {
    return this.prisma.missionExecution.findFirst({
      where: {
        userId,
        childId,
        status: { in: ACTIVE_MISSION_STATUSES },
      },
      select: ACTIVE_EXECUTION_SELECT,
      orderBy: { startedAt: 'desc' },
    });
  }

  private async findDefaultActiveExecution(
    userId: string,
  ): Promise<ActiveExecutionRow | null> {
    return this.prisma.missionExecution.findFirst({
      where: {
        userId,
        child: { deletedAt: null },
        status: { in: ACTIVE_MISSION_STATUSES },
      },
      select: ACTIVE_EXECUTION_SELECT,
      orderBy: { startedAt: 'desc' },
    });
  }
}

function toChildSummary(
  child: { id: string; name: string; birthDate: Date },
  today: Date,
) {
  return {
    id: child.id,
    name: child.name,
    birthDate: toDateOnly(
      new Date(child.birthDate.getTime() + 9 * 60 * 60 * 1000),
    ),
    ageLabel: getAgeLabel(child.birthDate, today),
  };
}
