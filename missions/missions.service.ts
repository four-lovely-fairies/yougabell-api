import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMissionDto,
  ListMissionsQueryDto,
  MissionSourceDto,
  UpdateMissionDto,
} from './dto/mission.dto';

type MissionRow = {
  id: string;
  categoryId: string;
  title: string;
  shortTitle: string;
  description: string;
  durationMinutes: number;
  effect: string;
  subThemeLabel: string | null;
  goal: string | null;
  recommendedAgeMonthsMin: number | null;
  recommendedAgeMonthsMax: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: string }[];
  sources: { citation: string; url: string | null; note: string | null }[];
};

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

const INCLUDE = {
  tags: { select: { tag: true } },
  sources: { select: { citation: true, url: true, note: true } },
};

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMissionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mission.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ categoryId: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.mission.count({ where }),
    ]);

    return {
      items: (rows as MissionRow[]).map(toResponse),
      total,
      page,
      pageSize,
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
        sources: sources && sources.length
          ? { createMany: { data: sources.map(toSourceRow) } }
          : undefined,
      },
      include: INCLUDE,
    });
    return toResponse(created as MissionRow);
  }

  async update(id: string, dto: UpdateMissionDto) {
    this.assertAgeRange(
      dto.recommendedAgeMonthsMin,
      dto.recommendedAgeMonthsMax,
    );
    const { tags, sources, ...rest } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      const mission = await tx.mission.update({
        where: { id },
        data: rest,
      });
      if (tags !== undefined) {
        await tx.missionTag.deleteMany({ where: { missionId: id } });
        if (tags.length) {
          await tx.missionTag.createMany({
            data: dedupe(tags).map((tag) => ({ missionId: id, tag })),
          });
        }
      }
      if (sources !== undefined) {
        await tx.missionSource.deleteMany({ where: { missionId: id } });
        if (sources.length) {
          await tx.missionSource.createMany({
            data: sources.map((s) => ({ missionId: id, ...toSourceRow(s) })),
          });
        }
      }
      return tx.mission.findUniqueOrThrow({
        where: { id: mission.id },
        include: INCLUDE,
      });
    });

    return toResponse(updated as MissionRow);
  }

  async remove(id: string) {
    await this.prisma.mission.delete({ where: { id } });
  }

  private assertAgeRange(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'recommendedAgeMonthsMin must be ≤ recommendedAgeMonthsMax.',
      });
    }
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
