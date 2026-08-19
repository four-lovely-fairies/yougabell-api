import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Inquiry, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInquiryDto,
  InquiryListItemDto,
  InquiryListResponseDto,
  InquiryResponseDto,
  ListInquiriesDto,
} from './dto/inquiry.dto';

/** 미답변 문의가 이 수를 넘으면 신규 등록을 막는다 (운영 마비 방지). */
export const MAX_OPEN_INQUIRIES = 5;

const OPEN_STATUSES = ['received', 'in_progress'] as const;

@Injectable()
export class InquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /inquiries — 1:1 문의 등록. */
  async createInquiry(
    userId: string,
    dto: CreateInquiryDto,
    fallbackEmail?: string,
  ): Promise<InquiryResponseDto> {
    const openCount = await this.prisma.inquiry.count({
      where: { userId, status: { in: [...OPEN_STATUSES] } },
    });

    if (openCount >= MAX_OPEN_INQUIRIES) {
      throw new ConflictException({
        code: 'TOO_MANY_OPEN_INQUIRIES',
        message: `You already have ${MAX_OPEN_INQUIRIES} inquiries awaiting an answer.`,
      });
    }

    const created = await this.prisma.inquiry.create({
      data: {
        userId,
        category: dto.category ?? null,
        title: dto.title.trim(),
        body: dto.body.trim(),
        contactEmail: dto.contactEmail?.trim() ?? fallbackEmail ?? null,
      },
    });

    return toInquiryResponse(created);
  }

  /** GET /inquiries — 내 문의 목록 (최신순). */
  async listInquiries(
    userId: string,
    query: ListInquiriesDto,
  ): Promise<InquiryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inquiry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_ITEM_SELECT,
      }),
      this.prisma.inquiry.count({ where: { userId } }),
    ]);

    return { items: items.map(toInquiryListItem), total, page, limit };
  }

  /** GET /inquiries/:id — 소유자 검증. 타인 문의는 존재를 노출하지 않고 404. */
  async getInquiry(
    userId: string,
    inquiryId: string,
  ): Promise<InquiryResponseDto> {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id: inquiryId, userId },
    });

    if (!inquiry) {
      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        message: 'Inquiry not found.',
      });
    }

    return toInquiryResponse(inquiry);
  }
}

export const LIST_ITEM_SELECT = {
  id: true,
  category: true,
  title: true,
  status: true,
  answeredAt: true,
  createdAt: true,
} as const satisfies Prisma.InquirySelect;

type InquiryListRow = Prisma.InquiryGetPayload<{
  select: typeof LIST_ITEM_SELECT;
}>;

export function toInquiryListItem(row: InquiryListRow): InquiryListItemDto {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    status: row.status,
    answeredAt: row.answeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toInquiryResponse(inquiry: Inquiry): InquiryResponseDto {
  return {
    ...toInquiryListItem(inquiry),
    body: inquiry.body,
    contactEmail: inquiry.contactEmail,
    answerBody: inquiry.answerBody,
  };
}

/** answered로 전환하려면 답변 본문이 반드시 있어야 한다. */
export function assertAnswerBodyPresent(
  answerBody: string | undefined,
  existingAnswerBody: string | null,
): void {
  if (!answerBody?.trim() && !existingAnswerBody?.trim()) {
    throw new BadRequestException({
      code: 'ANSWER_BODY_REQUIRED',
      message: 'An answer body is required to mark an inquiry as answered.',
    });
  }
}
