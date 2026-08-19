import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminInquiryDetailDto,
  AdminInquiryListItemDto,
  AdminInquiryListResponseDto,
  ListAdminInquiriesDto,
  UpdateInquiryDto,
} from './dto/admin-inquiry.dto';
import { assertAnswerBodyPresent } from './inquiries.service';

const OPEN_STATUSES = ['received', 'in_progress'] as const;

const USER_CONTEXT_SELECT = {
  name: true,
  onboardedAt: true,
  createdAt: true,
  deletedAt: true,
} as const satisfies Prisma.UserSelect;

@Injectable()
export class AdminInquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /admin/inquiries — 미답변 우선, 그 안에서 오래 기다린 순.
   *
   * Postgres enum은 선언 순서로 정렬되고 schema.prisma의 순서가
   * received → in_progress → answered이므로, `status asc`면 답변 완료가 마지막에 온다.
   * enum 순서를 바꾸면 이 정렬이 깨진다.
   */
  async listInquiries(
    query: ListAdminInquiriesDto,
  ): Promise<AdminInquiryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = query.status ?? 'all';

    const where: Prisma.InquiryWhereInput = {};
    if (status !== 'all') where.status = status;
    if (query.category) where.category = query.category;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { body: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total, openCount] = await this.prisma.$transaction([
      this.prisma.inquiry.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          category: true,
          title: true,
          status: true,
          answeredAt: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      this.prisma.inquiry.count({ where }),
      this.prisma.inquiry.count({
        where: { status: { in: [...OPEN_STATUSES] } },
      }),
    ]);

    return {
      items: items.map(
        (row): AdminInquiryListItemDto => ({
          id: row.id,
          userId: row.userId,
          userName: row.user.name,
          category: row.category,
          title: row.title,
          status: row.status,
          answeredAt: row.answeredAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
      total,
      openCount,
      page,
      limit,
    };
  }

  /** GET /admin/inquiries/:id — 답변 판단에 필요한 작성자 컨텍스트를 함께 반환. */
  async getInquiry(inquiryId: string): Promise<AdminInquiryDetailDto> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { user: { select: USER_CONTEXT_SELECT } },
    });

    if (!inquiry) {
      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        message: 'Inquiry not found.',
      });
    }

    return {
      id: inquiry.id,
      category: inquiry.category,
      title: inquiry.title,
      status: inquiry.status,
      answeredAt: inquiry.answeredAt?.toISOString() ?? null,
      createdAt: inquiry.createdAt.toISOString(),
      body: inquiry.body,
      contactEmail: inquiry.contactEmail,
      answerBody: inquiry.answerBody,
      userId: inquiry.userId,
      userName: inquiry.user.name,
      userOnboardedAt: inquiry.user.onboardedAt?.toISOString() ?? null,
      userCreatedAt: inquiry.user.createdAt.toISOString(),
      userDeletedAt: inquiry.user.deletedAt?.toISOString() ?? null,
    };
  }

  /**
   * PATCH /admin/inquiries/:id — 상태 변경 / 답변 저장.
   *
   * 답변 본문이 오면 상태를 answered로 강제 전환하고 사용자 알림을 만든다.
   * 이미 답변한 건을 수정하는 경우(answeredAt 존재) 알림은 다시 만들지 않는다.
   */
  async updateInquiry(
    adminUserId: string,
    inquiryId: string,
    dto: UpdateInquiryDto,
  ): Promise<AdminInquiryDetailDto> {
    const existing = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, userId: true, answerBody: true, answeredAt: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        message: 'Inquiry not found.',
      });
    }

    const answerBody = dto.answerBody?.trim();
    const becomesAnswered = Boolean(answerBody) || dto.status === 'answered';

    if (becomesAnswered) {
      assertAnswerBodyPresent(answerBody, existing.answerBody);
    }

    const data: Prisma.InquiryUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (answerBody) data.answerBody = answerBody;
    if (becomesAnswered) {
      data.status = 'answered';
      data.answeredBy = adminUserId;
      data.answeredAt = existing.answeredAt ?? new Date();
    }

    const isFirstAnswer = becomesAnswered && existing.answeredAt === null;

    await this.prisma.$transaction(async (tx) => {
      await tx.inquiry.update({ where: { id: inquiryId }, data });

      if (isFirstAnswer) {
        await tx.notification.create({
          data: {
            userId: existing.userId,
            type: 'inquiry_answered',
            title: '문의에 답변이 등록되었어요',
            body: '보내주신 문의에 답변이 도착했습니다. 확인해 보세요.',
            actionType: 'url',
            targetType: 'inquiry',
            targetId: inquiryId,
            targetUrl: `/settings/inquiries/${inquiryId}`,
            priority: 'normal',
          },
        });
      }
    });

    return this.getInquiry(inquiryId);
  }
}
