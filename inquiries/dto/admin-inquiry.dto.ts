import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InquiryCategory, InquiryStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  INQUIRY_CATEGORIES,
  INQUIRY_STATUSES,
  InquiryResponseDto,
} from './inquiry.dto';

export type AdminInquiryStatusFilter = InquiryStatus | 'all';

const STATUS_FILTERS = [...INQUIRY_STATUSES, 'all'] as const;

export class ListAdminInquiriesDto {
  @ApiPropertyOptional({
    enum: STATUS_FILTERS,
    description: '상태 필터. default all',
  })
  @IsOptional()
  @IsIn(STATUS_FILTERS)
  status?: AdminInquiryStatusFilter;

  @ApiPropertyOptional({ enum: INQUIRY_CATEGORIES })
  @IsOptional()
  @IsIn(INQUIRY_CATEGORIES)
  category?: InquiryCategory;

  @ApiPropertyOptional({ description: '제목·본문 LIKE 검색' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: '1-based', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * 운영자 문의 수정.
 *
 * `answerBody`가 있으면 상태를 answered로 강제 전환한다.
 * `status`만 answered로 보내면서 답변 본문이 비어 있으면 400.
 */
export class UpdateInquiryDto {
  @ApiPropertyOptional({ enum: INQUIRY_STATUSES })
  @IsOptional()
  @IsIn(INQUIRY_STATUSES)
  status?: InquiryStatus;

  @ApiPropertyOptional({ minLength: 1, maxLength: 4000 })
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  answerBody?: string;
}

/** 어드민 목록 항목 — 작성자 식별용 최소 정보만 동반한다. */
export class AdminInquiryListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ description: '작성자 이름' })
  userName!: string;

  @ApiProperty({ enum: INQUIRY_CATEGORIES, nullable: true })
  category!: InquiryCategory | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: INQUIRY_STATUSES })
  status!: InquiryStatus;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  answeredAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AdminInquiryListResponseDto {
  @ApiProperty({ type: [AdminInquiryListItemDto] })
  items!: AdminInquiryListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({ description: '미답변(received + in_progress) 총 건수' })
  openCount!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

/** 어드민 상세 — 답변 판단에 필요한 작성자 컨텍스트를 함께 싣는다. */
export class AdminInquiryDetailDto extends InquiryResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  userName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: '작성자 온보딩 완료 시각. null이면 미완료',
  })
  userOnboardedAt!: string | null;

  @ApiProperty({ format: 'date-time', description: '작성자 가입 시각' })
  userCreatedAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: '작성자 탈퇴 시각. null이면 활성 계정',
  })
  userDeletedAt!: string | null;
}
