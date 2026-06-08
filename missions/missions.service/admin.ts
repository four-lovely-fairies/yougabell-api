import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMissionDto,
  ListMissionsQueryDto,
  MissionSourceDto,
  UpdateMissionDto,
} from '../dto/mission.dto';

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

export async function listMissions(
  prisma: PrismaService,
  query: ListMissionsQueryDto,
) {
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
  const rows = await prisma.mission.findMany({
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

export async function createMission(
  prisma: PrismaService,
  dto: CreateMissionDto,
) {
  assertAgeRange(dto.recommendedAgeMonthsMin, dto.recommendedAgeMonthsMax);
  const { tags, sources, ...rest } = dto;
  const created = await prisma.mission.create({
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

export async function updateMission(
  prisma: PrismaService,
  id: string,
  dto: UpdateMissionDto,
) {
  assertAgeRange(dto.recommendedAgeMonthsMin, dto.recommendedAgeMonthsMax);
  const { tags, sources, ...rest } = dto;

  const updated = await prisma.mission.update({
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

export async function removeMission(prisma: PrismaService, id: string) {
  await prisma.mission.delete({ where: { id } });
}

function assertAgeRange(min?: number, max?: number) {
  if (min !== undefined && max !== undefined && min > max) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'recommendedAgeMonthsMin must be ≤ recommendedAgeMonthsMax.',
    });
  }
}

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
