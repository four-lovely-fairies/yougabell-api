import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMilestoneDto,
  ListMilestonesQueryDto,
  UpdateMilestoneDto,
} from './dto/milestone.dto';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMilestonesQueryDto) {
    const take = query.take ?? 50;

    const where = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.ageMonths !== undefined
        ? {
            ageMonthsFrom: { lte: query.ageMonths },
            ageMonthsTo: { gte: query.ageMonths },
          }
        : {}),
    };

    // cursor pagination — id desc(최신순) + take+1 fetch로 hasMore 판단.
    // UI에서 카테고리/월령 정렬은 client side(누적 데이터)에서 적용.
    const items = await this.prisma.milestone.findMany({
      where,
      orderBy: { id: 'asc' },
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > take;
    const trimmed = hasMore ? items.slice(0, take) : items;
    const nextCursor =
      hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return { items: trimmed, nextCursor };
  }

  async create(dto: CreateMilestoneDto) {
    if (dto.ageMonthsFrom > dto.ageMonthsTo) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'ageMonthsFrom must be ≤ ageMonthsTo.',
      });
    }
    return this.prisma.milestone.create({
      data: {
        categoryId: dto.categoryId,
        ageMonthsFrom: dto.ageMonthsFrom,
        ageMonthsTo: dto.ageMonthsTo,
        title: dto.title ?? null,
        description: dto.description,
        displayOrder: dto.displayOrder ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateMilestoneDto) {
    if (
      dto.ageMonthsFrom !== undefined &&
      dto.ageMonthsTo !== undefined &&
      dto.ageMonthsFrom > dto.ageMonthsTo
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'ageMonthsFrom must be ≤ ageMonthsTo.',
      });
    }
    return this.prisma.milestone.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        ageMonthsFrom: dto.ageMonthsFrom,
        ageMonthsTo: dto.ageMonthsTo,
        title: dto.title,
        description: dto.description,
        displayOrder: dto.displayOrder,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.milestone.delete({ where: { id } });
  }
}
