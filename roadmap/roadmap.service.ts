import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getAgeLabel, getAgeMonths } from '../home/home-date.utils';
import { milestoneAgeWhere } from '../milestones/milestone-age';
import {
  AGE_MONTH_MAX,
  AGE_MONTH_MIN,
  CDC_CHECKPOINTS,
  MONTH_TAB_WINDOW,
  ROADMAP_CATEGORY_ORDER,
  type RoadmapCategoryGroup,
  type RoadmapCategoryId,
  type RoadmapResponse,
  type MilestoneCompletionResponse,
} from './roadmap.types';

const SOURCE_TOOLTIP_TEXT =
  'CDC, AAP, 국민건강보험, 보건복지부 등 세계 소아과 전문의들이 가장 많이 참고하는 데이터를 바탕으로 설계된 발달 지표입니다.';

const CATEGORY_FALLBACK_LABEL: Record<RoadmapCategoryId, string> = {
  social: '사회성',
  language: '언어',
  cognitive: '인지',
  physical: '신체',
};

const CATEGORY_FALLBACK_ICON: Record<RoadmapCategoryId, string> = {
  social: 'groups',
  language: 'dictionary',
  cognitive: 'psychology_alt',
  physical: 'barefoot',
};

@Injectable()
export class RoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoadmap(
    userId: string,
    query: { childId?: string; targetMonth?: number },
  ): Promise<RoadmapResponse> {
    const today = new Date();
    const children = await this.prisma.child.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (children.length === 0) {
      throw new ConflictException({
        code: 'NO_CHILD_PROFILE',
        message: 'No active child profile exists.',
      });
    }

    const child = query.childId
      ? children.find((c) => c.id === query.childId)
      : children[0];

    if (!child) {
      throw new NotFoundException({
        code: 'CHILD_NOT_FOUND',
        message: 'Child not found.',
      });
    }

    const childAgeMonths = clampAge(getAgeMonths(child.birthDate, today));
    const requestedMonth =
      query.targetMonth !== undefined
        ? clampAge(query.targetMonth)
        : childAgeMonths;

    const targetMonth = resolveToCheckpoint(requestedMonth);
    const { tabs, range } = buildMonthTabs(targetMonth);

    const [categories, milestones, stage] = await Promise.all([
      this.prisma.milestoneCategory.findMany({
        where: { id: { in: ROADMAP_CATEGORY_ORDER } },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.milestone.findMany({
        where: {
          ...milestoneAgeWhere(targetMonth),
          categoryId: { in: ROADMAP_CATEGORY_ORDER },
        },
        include: { sources: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.growthStage.findFirst({
        where: {
          ageMonthsFrom: { lte: childAgeMonths },
          ageMonthsTo: { gte: childAgeMonths },
        },
        orderBy: { ageMonthsFrom: 'desc' },
      }),
    ]);

    const completions = await this.prisma.childMilestoneCompletion.findMany({
      where: {
        childId: child.id,
        milestoneId: { in: milestones.map((milestone) => milestone.id) },
      },
      select: { milestoneId: true, completedAt: true },
    });
    const completionByMilestoneId = new Map(
      completions.map((completion) => [
        completion.milestoneId,
        completion.completedAt,
      ]),
    );

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const groupedByCategory = new Map<RoadmapCategoryId, typeof milestones>();
    for (const milestone of milestones) {
      const key = milestone.categoryId as RoadmapCategoryId;
      const arr = groupedByCategory.get(key) ?? [];
      arr.push(milestone);
      groupedByCategory.set(key, arr);
    }

    const milestonesByCategory: RoadmapCategoryGroup[] =
      ROADMAP_CATEGORY_ORDER.map((categoryId) => {
        const meta = categoryById.get(categoryId);
        const items = groupedByCategory.get(categoryId) ?? [];
        return {
          categoryId,
          categoryLabel: meta?.label ?? CATEGORY_FALLBACK_LABEL[categoryId],
          iconKey: meta?.iconKey ?? CATEGORY_FALLBACK_ICON[categoryId],
          items: items.map((m) => ({
            id: m.id,
            description: m.description,
            completed: completionByMilestoneId.has(m.id),
            completedAt:
              completionByMilestoneId.get(m.id)?.toISOString() ?? null,
            sources: m.sources.map((s) => ({
              citation: s.citation,
              url: s.url,
            })),
          })),
        };
      });

    return {
      child: {
        id: child.id,
        name: child.name,
        ageMonths: childAgeMonths,
        ageLabel: getAgeLabel(child.birthDate, today),
      },
      stage: stage
        ? { id: stage.id, name: stage.name, summary: stage.summary }
        : null,
      targetMonth,
      monthTabs: tabs,
      monthTabRange: range,
      milestonesByCategory,
      sourceTooltip: { text: SOURCE_TOOLTIP_TEXT },
    };
  }

  async setMilestoneCompletion(
    userId: string,
    milestoneId: string,
    body: { childId: string; completed: boolean },
  ): Promise<MilestoneCompletionResponse> {
    const [child, milestone] = await Promise.all([
      this.prisma.child.findFirst({
        where: { id: body.childId, userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { id: true },
      }),
    ]);

    if (!child) {
      throw new NotFoundException({
        code: 'CHILD_NOT_FOUND',
        message: 'Child not found.',
      });
    }
    if (!milestone) {
      throw new NotFoundException({
        code: 'MILESTONE_NOT_FOUND',
        message: 'Milestone not found.',
      });
    }

    if (!body.completed) {
      await this.prisma.childMilestoneCompletion.deleteMany({
        where: { childId: child.id, milestoneId },
      });
      return { milestoneId, completed: false, completedAt: null };
    }

    const completion = await this.prisma.childMilestoneCompletion.upsert({
      where: {
        childId_milestoneId: { childId: child.id, milestoneId },
      },
      create: { childId: child.id, milestoneId },
      update: {},
      select: { completedAt: true },
    });

    return {
      milestoneId,
      completed: true,
      completedAt: completion.completedAt.toISOString(),
    };
  }
}

function clampAge(months: number): number {
  if (!Number.isFinite(months)) return AGE_MONTH_MIN;
  return Math.max(AGE_MONTH_MIN, Math.min(AGE_MONTH_MAX, Math.floor(months)));
}

/**
 * 입력 월령을 CDC 체크포인트 중 가장 가까운 하단 값으로 보정.
 * 첫 체크포인트(2개월)보다 작으면 첫 체크포인트 반환.
 */
function resolveToCheckpoint(months: number): number {
  let resolved = CDC_CHECKPOINTS[0];
  for (const checkpoint of CDC_CHECKPOINTS) {
    if (checkpoint <= months) {
      resolved = checkpoint;
    } else {
      break;
    }
  }
  return resolved;
}

/**
 * 5개 윈도우 슬라이딩.
 * - 대상 월령이 중앙(idx 2)에 오도록 시도. 양 끝에 가까우면 한쪽으로 치우침.
 * - monthTabRange.prev/next는 5개 윈도우 단위 점프 (chevron 클릭 시 이동 대상).
 */
function buildMonthTabs(target: number): {
  tabs: number[];
  range: { prev: number | null; next: number | null };
} {
  const targetIdx = CDC_CHECKPOINTS.indexOf(target);
  const total = CDC_CHECKPOINTS.length;

  if (targetIdx === -1) {
    return {
      tabs: CDC_CHECKPOINTS.slice(0, MONTH_TAB_WINDOW),
      range: { prev: null, next: null },
    };
  }

  const half = Math.floor(MONTH_TAB_WINDOW / 2);
  let start = targetIdx - half;
  if (start < 0) start = 0;
  if (start + MONTH_TAB_WINDOW > total) {
    start = Math.max(0, total - MONTH_TAB_WINDOW);
  }
  const end = Math.min(total, start + MONTH_TAB_WINDOW);
  const tabs = CDC_CHECKPOINTS.slice(start, end);

  const prevIdx = start - MONTH_TAB_WINDOW;
  const nextIdx = end;
  return {
    tabs,
    range: {
      prev: prevIdx >= 0 ? CDC_CHECKPOINTS[prevIdx] : null,
      next: nextIdx < total ? CDC_CHECKPOINTS[nextIdx] : null,
    },
  };
}
