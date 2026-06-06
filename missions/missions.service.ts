import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MissionExecutionStatus, Prisma } from '@prisma/client';
import { getAgeLabel, getAgeMonths, toDateOnly } from '../home/home-date.utils';
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
  UpsertMissionFeedbackDto,
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

type CurrentMissionStatus = 'not_started' | 'in_progress' | 'completed';

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

const EFFECT_EXECUTION_SELECT = {
  id: true,
  status: true,
  completedAt: true,
  actualDurationSeconds: true,
  wasEarlyCompleted: true,
  child: { select: { deletedAt: true } },
  mission: {
    select: {
      id: true,
      title: true,
      effect: true,
      goal: true,
      subThemeLabel: true,
    },
  },
} satisfies Prisma.MissionExecutionSelect;

const FEEDBACK_EXECUTION_SELECT = {
  id: true,
  status: true,
  child: { select: { deletedAt: true } },
} satisfies Prisma.MissionExecutionSelect;

const FEEDBACK_SELECT = {
  id: true,
  executionId: true,
  childReaction: true,
  parentEnergy: true,
  missionSatisfaction: true,
  note: true,
  createdAt: true,
  keywords: {
    select: { keyword: true, rank: true },
    orderBy: { rank: 'asc' },
  },
} satisfies Prisma.MissionFeedbackSelect;

type FeedbackRow = Prisma.MissionFeedbackGetPayload<{
  select: typeof FEEDBACK_SELECT;
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
    const [currentMission, activeExecution] = await Promise.all([
      this.findCurrentMission(selectedChild.id, ageMonths, today),
      this.findActiveExecution(userId, selectedChild.id),
    ]);

    if (!currentMission) {
      throw new NotFoundException({
        code: 'CURRENT_MISSION_NOT_FOUND',
        message: 'Current mission not found.',
      });
    }

    return {
      selectedChild: {
        id: selectedChild.id,
        name: selectedChild.name,
        birthDate: toDateOnly(
          new Date(selectedChild.birthDate.getTime() + 9 * 60 * 60 * 1000),
        ),
        ageLabel: getAgeLabel(selectedChild.birthDate, today),
      },
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        birthDate: toDateOnly(
          new Date(child.birthDate.getTime() + 9 * 60 * 60 * 1000),
        ),
        ageLabel: getAgeLabel(child.birthDate, today),
      })),
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

    const normalizedKeywords = normalizeMissionFeedbackKeywords(
      dto.note ?? null,
    );

    const feedback = await this.prisma.missionFeedback.upsert({
      where: { executionId },
      create: {
        executionId,
        childReaction: dto.childReaction,
        parentEnergy: dto.parentEnergy,
        missionSatisfaction: dto.missionSatisfaction,
        note: normalizeFeedbackNote(dto.note),
        keywords: normalizedKeywords.length
          ? {
              createMany: {
                data: normalizedKeywords.map((keyword, index) => ({
                  rank: index + 1,
                  keyword,
                })),
              },
            }
          : undefined,
      },
      update: {
        childReaction: dto.childReaction,
        parentEnergy: dto.parentEnergy,
        missionSatisfaction: dto.missionSatisfaction,
        note: normalizeFeedbackNote(dto.note),
        keywords: {
          deleteMany: {},
          ...(normalizedKeywords.length
            ? {
                createMany: {
                  data: normalizedKeywords.map((keyword, index) => ({
                    rank: index + 1,
                    keyword,
                  })),
                },
              }
            : {}),
        },
      },
      select: FEEDBACK_SELECT,
    });

    return {
      feedback: toMissionFeedbackResponse(feedback),
    };
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

  // 오늘의 추천 미션 선정.
  // 1) 아이 월령·카테고리·추천연령에 맞는 후보 미션 전체를 모은다.
  // 2) 아이별 수행(완료) 횟수를 집계해, **최저 횟수 그룹**만 후보로 남긴다.
  //    (0회 우선 → 모두 1회가 되면 1회끼리 → … 최저 숫자 기준으로 균등 소진/로테이션.)
  // 3) 같은 그룹 안에서는 서울 날짜 + 아이 id 해시로 결정적 1개 선택 → 같은 날엔 동일,
  //    날짜가 바뀌면 그룹 내 로테이션.
  private async findRecommendedMission(
    childId: string,
    ageMonths: number,
    today: Date,
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

    const candidates = await this.prisma.mission.findMany({
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

    if (candidates.length === 0) {
      return null;
    }

    // 아이별 미션 수행(완료) 횟수 집계.
    const counts = await this.prisma.missionExecution.groupBy({
      by: ['missionId'],
      where: {
        childId,
        status: {
          in: [
            MissionExecutionStatus.completed,
            MissionExecutionStatus.early_completed,
          ],
        },
      },
      _count: { _all: true },
    });
    const countByMission = new Map(
      counts.map((row) => [row.missionId, row._count._all]),
    );

    // 후보별 수행횟수 → 최저 횟수 그룹만 남긴다 (0회 우선, 모두 1이면 1회끼리…).
    const withCount = candidates.map((mission) => ({
      mission,
      count: countByMission.get(mission.id) ?? 0,
    }));
    const minCount = Math.min(...withCount.map((entry) => entry.count));
    const pool = withCount
      .filter((entry) => entry.count === minCount)
      .map((entry) => entry.mission);

    // 최저 횟수 그룹 안에서 서울 날짜 + 아이 해시로 결정적 로테이션.
    const index = hashToIndex(
      `${toSeoulDateKey(today)}:${childId}`,
      pool.length,
    );
    return pool[index] ?? null;
  }

  private async findCurrentMission(
    childId: string,
    ageMonths: number,
    today: Date,
  ): Promise<{
    mission: CurrentMissionRow;
    status: CurrentMissionStatus;
  } | null> {
    const todayKey = toSeoulDateKey(today);
    const todayStart = new Date(`${todayKey}T00:00:00+09:00`);
    const todayEnd = new Date(`${todayKey}T23:59:59.999+09:00`);

    const existingExecution = await this.prisma.missionExecution.findFirst({
      where: {
        childId,
        startedAt: { gte: todayStart, lte: todayEnd },
        status: { not: 'cancelled' },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        status: true,
        mission: { select: CURRENT_MISSION_SELECT },
      },
    });

    if (existingExecution) {
      return {
        mission: existingExecution.mission,
        status: toCurrentMissionStatus(existingExecution.status),
      };
    }

    const mission = await this.findRecommendedMission(
      childId,
      ageMonths,
      today,
    );

    if (!mission) {
      return null;
    }

    return {
      mission,
      status: 'not_started',
    };
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

// 문자열 시드 → [0, length) 결정적 인덱스 (날짜·아이 기준 미션 로테이션용).
function hashToIndex(seed: string, length: number): number {
  if (length <= 0) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % length) + length) % length;
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

function toCurrentMissionStatus(
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

function toSeoulDateKey(date: Date): string {
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${seoul.getUTCFullYear()}-${String(seoul.getUTCMonth() + 1).padStart(2, '0')}-${String(seoul.getUTCDate()).padStart(2, '0')}`;
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

function normalizeFeedbackNote(note: string | null | undefined) {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMissionFeedbackKeywords(note: string | null) {
  const trimmed = note?.trim() ?? '';

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/[\n,\s]+/u)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .map(normalizeKeyword)
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeKeyword(keyword: string) {
  if (!keyword) {
    return '';
  }

  return /^[A-Za-z]+$/.test(keyword) ? keyword.toLowerCase() : keyword;
}

function toMissionFeedbackResponse(feedback: FeedbackRow) {
  return {
    id: feedback.id,
    executionId: feedback.executionId,
    childReaction: feedback.childReaction,
    parentEnergy: feedback.parentEnergy,
    missionSatisfaction: feedback.missionSatisfaction,
    note: feedback.note,
    keywords: feedback.keywords.map((keyword) => keyword.keyword),
    createdAt: feedback.createdAt.toISOString(),
  };
}
