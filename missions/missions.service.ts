import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MissionExecutionStatus, Prisma } from '@prisma/client';
import { getAgeLabel, getAgeMonths } from '../home/home-date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMissionDto,
  ListMissionsQueryDto,
  MissionSourceDto,
  UpdateMissionDto,
} from './dto/mission.dto';
import {
  GetActiveMissionExecutionQueryDto,
  GetCurrentMissionQueryDto,
  MissionExecutionSnapshotDto,
  StartMissionExecutionDto,
} from './dto/mission-flow.dto';

const ADMIN_MISSION_SELECT = {
  id: true,
  categoryId: true,
  title: true,
  shortTitle: true,
  description: true,
  durationMinutes: true,
  effect: true,
  subThemeLabel: true,
  goal: true,
  recommendedAgeMonthsMin: true,
  recommendedAgeMonthsMax: true,
  thumbnailUrl: true,
  videoUrl: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { tag: true } },
  sources: { select: { citation: true, url: true, note: true } },
} satisfies Prisma.MissionSelect;

type MissionRow = Prisma.MissionGetPayload<{
  select: typeof ADMIN_MISSION_SELECT;
}>;

const CURRENT_MISSION_SELECT = {
  id: true,
  title: true,
  description: true,
  subThemeLabel: true,
  durationMinutes: true,
  category: { select: { label: true } },
  sources: { select: { citation: true }, orderBy: { citation: 'asc' } },
} satisfies Prisma.MissionSelect;

type CurrentMissionRow = Prisma.MissionGetPayload<{
  select: typeof CURRENT_MISSION_SELECT;
}>;

const ACTIVE_EXECUTION_SELECT = {
  id: true,
  childId: true,
  missionId: true,
  status: true,
  startedAt: true,
  activeSegmentStartedAt: true,
  pausedAt: true,
  elapsedSeconds: true,
  mission: { select: { durationMinutes: true } },
} satisfies Prisma.MissionExecutionSelect;

type ActiveExecutionRow = Prisma.MissionExecutionGetPayload<{
  select: typeof ACTIVE_EXECUTION_SELECT;
}>;

function toResponse(row: MissionRow) {
  const { tags, sources, ...rest } = row;
  return {
    ...rest,
    tags: tags.map((t) => t.tag),
    sources: sources.map((s) => ({
      citation: s.citation,
      url: s.url,
      note: s.note,
    })),
  };
}

const ACTIVE_MISSION_STATUSES: MissionExecutionStatus[] = [
  'in_progress',
  'paused',
];

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMissionsQueryDto) {
    const take = query.take ?? 50;

    const where = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.ageMonths !== undefined
        ? {
            AND: [
              {
                OR: [
                  { recommendedAgeMonthsMin: null },
                  { recommendedAgeMonthsMin: { lte: query.ageMonths } },
                ],
              },
              {
                OR: [
                  { recommendedAgeMonthsMax: null },
                  { recommendedAgeMonthsMax: { gte: query.ageMonths } },
                ],
              },
            ],
          }
        : {}),
    };

    // cursor pagination — id asc + take+1 fetch.
    const rows = await this.prisma.mission.findMany({
      where,
      select: ADMIN_MISSION_SELECT,
      orderBy: { id: 'asc' },
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const trimmed = hasMore ? rows.slice(0, take) : rows;
    const nextCursor =
      hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      items: trimmed.map(toResponse),
      nextCursor,
    };
  }

  async create(dto: CreateMissionDto) {
    this.assertAgeRange(
      dto.recommendedAgeMonthsMin,
      dto.recommendedAgeMonthsMax,
    );
    const { tags, sources, ...rest } = dto;
    const created = await this.prisma.mission.create({
      data: {
        ...rest,
        subThemeLabel: rest.subThemeLabel ?? null,
        goal: rest.goal ?? null,
        recommendedAgeMonthsMin: rest.recommendedAgeMonthsMin ?? null,
        recommendedAgeMonthsMax: rest.recommendedAgeMonthsMax ?? null,
        thumbnailUrl: rest.thumbnailUrl ?? null,
        videoUrl: rest.videoUrl ?? null,
        tags:
          tags && tags.length
            ? { createMany: { data: dedupe(tags).map((tag) => ({ tag })) } }
            : undefined,
        sources:
          sources && sources.length
            ? { createMany: { data: sources.map(toSourceRow) } }
            : undefined,
      },
      select: ADMIN_MISSION_SELECT,
    });
    return toResponse(created);
  }

  async update(id: string, dto: UpdateMissionDto) {
    this.assertAgeRange(
      dto.recommendedAgeMonthsMin,
      dto.recommendedAgeMonthsMax,
    );
    const { tags, sources, ...rest } = dto;

    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        ...rest,
        ...(tags !== undefined
          ? {
              tags: {
                deleteMany: {},
                ...(tags.length
                  ? {
                      createMany: {
                        data: dedupe(tags).map((tag) => ({ tag })),
                      },
                    }
                  : {}),
              },
            }
          : {}),
        ...(sources !== undefined
          ? {
              sources: {
                deleteMany: {},
                ...(sources.length
                  ? {
                      createMany: {
                        data: sources.map(toSourceRow),
                      },
                    }
                  : {}),
              },
            }
          : {}),
      },
      select: ADMIN_MISSION_SELECT,
    });

    return toResponse(updated);
  }

  async remove(id: string) {
    await this.prisma.mission.delete({ where: { id } });
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
    const [mission, activeExecution] = await Promise.all([
      this.findRecommendedMission(ageMonths),
      this.findActiveExecution(userId, selectedChild.id),
    ]);

    if (!mission) {
      throw new NotFoundException({
        code: 'CURRENT_MISSION_NOT_FOUND',
        message: 'Current mission not found.',
      });
    }

    return {
      selectedChild: {
        id: selectedChild.id,
        name: selectedChild.name,
        ageLabel: getAgeLabel(selectedChild.birthDate, today),
      },
      mission: {
        id: mission.id,
        subThemeLabel: mission.subThemeLabel,
        title: mission.title,
        description: mission.description,
        durationMinutes: mission.durationMinutes,
        durationLabel: `${mission.durationMinutes}분`,
        categoryLabel: mission.category.label,
        sourceLabel: mission.sources[0]?.citation ?? '출처 없음',
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
    action: 'pause' | 'resume' | 'complete' | 'early_complete',
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

    const now = new Date();
    const totalElapsedSeconds = getCurrentElapsedSeconds(execution, now);

    if (action === 'pause') {
      if (
        execution.status !== 'in_progress' ||
        !execution.activeSegmentStartedAt
      ) {
        throw new BadRequestException({
          code: 'MISSION_EXECUTION_ACTION_INVALID',
          message: 'Mission execution cannot be paused.',
        });
      }

      const updated = await this.prisma.missionExecution.update({
        where: { id: executionId },
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

    if (action === 'resume') {
      if (execution.status !== 'paused') {
        throw new BadRequestException({
          code: 'MISSION_EXECUTION_ACTION_INVALID',
          message: 'Mission execution cannot be resumed.',
        });
      }

      const updated = await this.prisma.missionExecution.update({
        where: { id: executionId },
        data: {
          status: 'in_progress',
          activeSegmentStartedAt: now,
          pausedAt: null,
        },
        select: ACTIVE_EXECUTION_SELECT,
      });
      return { execution: toMissionExecutionSnapshot(updated, now) };
    }

    if (action === 'complete') {
      if (execution.status !== 'in_progress' && execution.status !== 'paused') {
        throw new BadRequestException({
          code: 'MISSION_EXECUTION_ACTION_INVALID',
          message: 'Mission execution cannot be completed.',
        });
      }

      await this.prisma.missionExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          completedAt: now,
          actualDurationSeconds: Math.min(
            execution.mission.durationMinutes * 60,
            totalElapsedSeconds,
          ),
          elapsedSeconds: Math.min(
            execution.mission.durationMinutes * 60,
            totalElapsedSeconds,
          ),
          activeSegmentStartedAt: null,
          pausedAt: null,
          wasEarlyCompleted: false,
        },
      });
      return { execution: null };
    }

    if (execution.status !== 'in_progress' && execution.status !== 'paused') {
      throw new BadRequestException({
        code: 'MISSION_EXECUTION_ACTION_INVALID',
        message: 'Mission execution cannot be early completed.',
      });
    }

    await this.prisma.missionExecution.update({
      where: { id: executionId },
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

  private assertAgeRange(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'recommendedAgeMonthsMin must be ≤ recommendedAgeMonthsMax.',
      });
    }
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

  private async findRecommendedMission(
    ageMonths: number,
  ): Promise<CurrentMissionRow | null> {
    const milestones = await this.prisma.milestone.findMany({
      where: {
        ageMonthsFrom: { lte: ageMonths },
        ageMonthsTo: { gte: ageMonths },
      },
      select: { categoryId: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const categoryIds = [
      ...new Set(milestones.map((milestone) => milestone.categoryId)),
    ];

    return this.prisma.mission.findFirst({
      where: {
        ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
        OR: [
          { recommendedAgeMonthsMin: null },
          { recommendedAgeMonthsMin: { lte: ageMonths } },
        ],
        AND: [
          {
            OR: [
              { recommendedAgeMonthsMax: null },
              { recommendedAgeMonthsMax: { gte: ageMonths } },
            ],
          },
        ],
      },
      select: CURRENT_MISSION_SELECT,
      orderBy: { createdAt: 'asc' },
    });
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

function dedupe(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

function toSourceRow(s: MissionSourceDto) {
  return {
    citation: s.citation.trim(),
    url: s.url?.trim() || null,
    note: s.note?.trim() || null,
  };
}

function getCurrentElapsedSeconds(
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

function toActiveExecution(
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

function toMissionExecutionSnapshot(
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
