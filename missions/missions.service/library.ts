import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MissionHistoryQueryDto,
  MissionLibraryQueryDto,
} from '../dto/mission-flow.dto';

// 관심 놀이 · 놀이 내역 목록에 공통으로 쓰는 놀이 정보.
const LIBRARY_MISSION_SELECT = {
  id: true,
  title: true,
  shortTitle: true,
  description: true,
  durationMinutes: true,
  goal: true,
  categoryId: true,
  category: { select: { label: true } },
  sources: { select: { citation: true }, orderBy: { citation: 'asc' } },
} satisfies Prisma.MissionSelect;

type LibraryMissionRow = Prisma.MissionGetPayload<{
  select: typeof LIBRARY_MISSION_SELECT;
}>;

const DEFAULT_LIMIT = 50;

const toLibraryItem = (mission: LibraryMissionRow, isFavorite: boolean) => ({
  missionId: mission.id,
  title: mission.title,
  shortTitle: mission.shortTitle,
  description: mission.description,
  durationMinutes: mission.durationMinutes,
  durationLabel: `${mission.durationMinutes}분`,
  categoryId: mission.categoryId,
  categoryLabel: mission.category.label,
  // 오늘의 놀이(/missions/current)와 같은 규칙 — 첫 번째 출처, 없으면 '출처 없음'
  sourceLabel: mission.sources[0]?.citation ?? '출처 없음',
  // 놀이 상세 '목표' 줄 (오늘의 놀이와 같은 값)
  goalLabel: mission.goal ?? null,
  isFavorite,
});

// 검색어(제목) + 발달 영역 필터.
const missionFilter = (
  query: MissionLibraryQueryDto,
): Prisma.MissionWhereInput => {
  const q = query.q?.trim();
  return {
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  };
};

const sortDirection = (query: MissionLibraryQueryDto): Prisma.SortOrder =>
  query.order === 'oldest' ? 'asc' : 'desc';

export async function isFavoriteMission(
  prisma: PrismaService,
  userId: string,
  missionId: string,
): Promise<boolean> {
  const row = await prisma.favoriteMission.findUnique({
    where: { userId_missionId: { userId, missionId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function listFavoriteMissions(
  prisma: PrismaService,
  userId: string,
  query: MissionLibraryQueryDto,
) {
  const where: Prisma.FavoriteMissionWhereInput = {
    userId,
    mission: missionFilter(query),
  };
  const [rows, total] = await Promise.all([
    prisma.favoriteMission.findMany({
      where,
      orderBy: { createdAt: sortDirection(query) },
      take: query.limit ?? DEFAULT_LIMIT,
      skip: query.offset ?? 0,
      select: {
        createdAt: true,
        mission: { select: LIBRARY_MISSION_SELECT },
      },
    }),
    prisma.favoriteMission.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      ...toLibraryItem(row.mission, true),
      savedAt: row.createdAt.toISOString(),
    })),
    total,
  };
}

export async function setFavoriteMission(
  prisma: PrismaService,
  userId: string,
  missionId: string,
  favorite: boolean,
) {
  if (favorite) {
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: { id: true },
    });
    if (!mission) {
      throw new NotFoundException({
        code: 'MISSION_NOT_FOUND',
        message: 'Mission not found.',
      });
    }
    // 여러 번 눌러도 하나만 남도록 upsert.
    await prisma.favoriteMission.upsert({
      where: { userId_missionId: { userId, missionId } },
      create: { userId, missionId },
      update: {},
    });
  } else {
    await prisma.favoriteMission.deleteMany({ where: { userId, missionId } });
  }
  return { missionId, isFavorite: favorite };
}

// 놀이 내역 — 완료(조기 완료 포함)한 실행을 완료 시각 기준으로 정렬한다.
export async function listMissionHistory(
  prisma: PrismaService,
  userId: string,
  query: MissionHistoryQueryDto,
) {
  const where: Prisma.MissionExecutionWhereInput = {
    userId,
    status: { in: ['completed', 'early_completed'] },
    // 기간 조회 — from 포함, to 미포함. 둘 다 없으면 전체.
    completedAt: {
      not: null,
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lt: new Date(query.to) } : {}),
    },
    child: { deletedAt: null },
    ...(query.childId ? { childId: query.childId } : {}),
    mission: missionFilter(query),
  };

  const [rows, total] = await Promise.all([
    prisma.missionExecution.findMany({
      where,
      orderBy: { completedAt: sortDirection(query) },
      take: query.limit ?? DEFAULT_LIMIT,
      skip: query.offset ?? 0,
      select: {
        id: true,
        childId: true,
        status: true,
        completedAt: true,
        actualDurationSeconds: true,
        feedback: { select: { id: true } },
        mission: { select: LIBRARY_MISSION_SELECT },
      },
    }),
    prisma.missionExecution.count({ where }),
  ]);

  const missionIds = [...new Set(rows.map((row) => row.mission.id))];
  const favorites =
    missionIds.length > 0
      ? await prisma.favoriteMission.findMany({
          where: { userId, missionId: { in: missionIds } },
          select: { missionId: true },
        })
      : [];
  const favoriteIds = new Set(favorites.map((row) => row.missionId));

  return {
    items: rows.map((row) => ({
      ...toLibraryItem(row.mission, favoriteIds.has(row.mission.id)),
      executionId: row.id,
      childId: row.childId,
      status: row.status as 'completed' | 'early_completed',
      completedAt: (row.completedAt ?? new Date(0)).toISOString(),
      actualDurationSeconds: row.actualDurationSeconds,
      hasFeedback: Boolean(row.feedback),
    })),
    total,
  };
}
