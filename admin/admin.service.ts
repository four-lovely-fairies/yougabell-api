import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WeeklyReportsService } from '../weekly-reports/weekly-reports.service';
import { GenerateWeeklyReportsDto } from './dto/generate-weekly-reports.dto';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weeklyReportsService: WeeklyReportsService,
  ) {}

  async listUsers(query: ListUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const onboarded = query.onboarded ?? 'true';

    const where: Prisma.UserWhereInput = {};
    if (onboarded === 'true') where.onboardedAt = { not: null };
    else if (onboarded === 'false') where.onboardedAt = null;
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ onboardedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          birthDate: true,
          gender: true,
          workStatus: true,
          onboardedAt: true,
          createdAt: true,
          _count: { select: { children: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        birthDate: u.birthDate?.toISOString() ?? null,
        gender: u.gender,
        workStatus: u.workStatus,
        onboardedAt: u.onboardedAt?.toISOString() ?? null,
        childrenCount: u._count.children,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  generateWeeklyReports(dto: GenerateWeeklyReportsDto) {
    return this.weeklyReportsService.generateForWeek({
      weekStart: dto.weekStart,
      forceRegenerate: dto.forceRegenerate,
      ...(dto.dryRun === undefined ? {} : { dryRun: dto.dryRun }),
    });
  }
}
