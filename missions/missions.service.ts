import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMissionDto,
  ListMissionsQueryDto,
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
  recommendedAgeMonthsMin: number | null;
  recommendedAgeMonthsMax: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: string }[];
};

function toResponse(row: MissionRow) {
  const { tags, ...rest } = row;
  return { ...rest, tags: tags.map((t) => t.tag) };
}

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
        include: { tags: { select: { tag: true } } },
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
    const { tags, ...rest } = dto;
    const created = await this.prisma.mission.create({
      data: {
        ...rest,
        subThemeLabel: rest.subThemeLabel ?? null,
        recommendedAgeMonthsMin: rest.recommendedAgeMonthsMin ?? null,
        recommendedAgeMonthsMax: rest.recommendedAgeMonthsMax ?? null,
        thumbnailUrl: rest.thumbnailUrl ?? null,
        videoUrl: rest.videoUrl ?? null,
        tags:
          tags && tags.length
            ? { createMany: { data: dedupe(tags).map((tag) => ({ tag })) } }
            : undefined,
      },
      include: { tags: { select: { tag: true } } },
    });
    return toResponse(created);
  }

  async update(id: string, dto: UpdateMissionDto) {
    this.assertAgeRange(
      dto.recommendedAgeMonthsMin,
      dto.recommendedAgeMonthsMax,
    );
    const { tags, ...rest } = dto;

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
      return tx.mission.findUniqueOrThrow({
        where: { id: mission.id },
        include: { tags: { select: { tag: true } } },
      });
    });

    return toResponse(updated);
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
