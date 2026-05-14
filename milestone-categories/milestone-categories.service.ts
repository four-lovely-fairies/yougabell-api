import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MilestoneCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.milestoneCategory.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }
}
