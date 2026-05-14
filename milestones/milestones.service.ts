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
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.ageMonths !== undefined
        ? {
            ageMonthsFrom: { lte: query.ageMonths },
            ageMonthsTo: { gte: query.ageMonths },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.milestone.findMany({
        where,
        orderBy: [
          { categoryId: 'asc' },
          { ageMonthsFrom: 'asc' },
          { displayOrder: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.milestone.count({ where }),
    ]);

    return { items, total, page, pageSize };
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
