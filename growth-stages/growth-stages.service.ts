import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGrowthStageDto,
  UpdateGrowthStageDto,
} from './dto/growth-stage.dto';

@Injectable()
export class GrowthStagesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.growthStage.findMany({
      orderBy: [{ ageMonthsFrom: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateGrowthStageDto) {
    if (dto.ageMonthsFrom > dto.ageMonthsTo) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'ageMonthsFrom must be ≤ ageMonthsTo.',
      });
    }
    return this.prisma.growthStage.create({ data: dto });
  }

  async update(id: string, dto: UpdateGrowthStageDto) {
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
    return this.prisma.growthStage.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.prisma.growthStage.delete({ where: { id } });
  }
}
