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

    // 이메일은 인증 시스템(Supabase Auth)에만 보관한다. 목록 API에는 원문을
    // 절대 내보내지 않고, 여기서 검색에만 사용한 뒤 응답에는 마스킹한 값만 담는다.
    const matchingEmailUserIds = query.q
      ? await this.findUserIdsByEmail(query.q)
      : [];
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        ...(matchingEmailUserIds.length > 0
          ? [{ id: { in: matchingEmailUserIds } }]
          : []),
      ];
    }

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

    const maskedEmails = await this.getMaskedEmails(items.map((user) => user.id));

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
        maskedEmail: maskedEmails.get(u.id) ?? null,
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

  private async findUserIdsByEmail(query: string): Promise<string[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const users = await this.listAuthUsers();
    return users
      .filter((user) => user.email?.toLowerCase().includes(normalizedQuery))
      .map((user) => user.id);
  }

  private async getMaskedEmails(userIds: string[]): Promise<Map<string, string>> {
    const emails = await Promise.all(
      userIds.map(async (id) => {
        const user = await this.getAuthUser(id);
        return user?.email ? ([id, maskEmail(user.email)] as const) : null;
      }),
    );
    return new Map(
      emails.filter((entry): entry is readonly [string, string] => entry !== null),
    );
  }

  private async listAuthUsers(): Promise<AuthUser[]> {
    const users: AuthUser[] = [];
    let page = 1;

    // GoTrue의 관리자 목록은 페이지 단위다. 이메일 검색은 운영자 화면에서만
    // 사용되며, 필요한 경우에만 전체 목록을 순회한다.
    while (true) {
      const response = await this.authRequest(`/admin/users?page=${page}&per_page=1000`);
      const payload = (await response.json()) as AuthUsersPage;
      users.push(...payload.users);
      if (!payload.nextPage) return users;
      page = payload.nextPage;
    }
  }

  private async getAuthUser(id: string): Promise<AuthUser | null> {
    const response = await this.authRequest(`/admin/users/${id}`);
    if (response.status === 404) return null;
    return (await response.json()) as AuthUser;
  }

  private async authRequest(path: string): Promise<Response> {
    const url = process.env.SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for email lookup');
    }

    const response = await fetch(`${url}/auth/v1${path}`, {
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
      },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase Auth API ${response.status} during email lookup`);
    }
    return response;
  }
}

type AuthUser = {
  id: string;
  email?: string;
};

type AuthUsersPage = {
  users: AuthUser[];
  nextPage?: number | null;
};

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '';

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localMask =
    local.length <= 3 ? `${local[0] ?? ''}***` : `${local.slice(0, 3)}***`;
  const dotIndex = domain.indexOf('.');
  const domainMask = dotIndex > 0 ? `*${domain.slice(dotIndex)}` : '*';
  return `${localMask}@${domainMask}`;
}
