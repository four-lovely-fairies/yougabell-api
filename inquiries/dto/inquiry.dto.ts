import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InquiryCategory, InquiryStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const INQUIRY_CATEGORIES = [
  'service_error',
  'account',
  'content',
  'suggestion',
  'etc',
] as const satisfies InquiryCategory[];

export const INQUIRY_STATUSES = [
  'received',
  'in_progress',
  'answered',
] as const satisfies InquiryStatus[];

/** POST /inquiries — 1:1 문의 등록. status는 서버가 received로 고정한다. */
export class CreateInquiryDto {
  @ApiPropertyOptional({
    enum: INQUIRY_CATEGORIES,
    description: '문의 유형. 선택 입력 — 미분류 제출을 허용한다.',
  })
  @IsOptional()
  @IsIn(INQUIRY_CATEGORIES)
  category?: InquiryCategory;

  @ApiProperty({
    example: '미션 타이머가 멈춰요',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  title!: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @Length(10, 2000)
  body!: string;

  @ApiPropertyOptional({
    example: 'parent@example.com',
    maxLength: 254,
    description: '답변 받을 이메일. 미지정 시 로그인 이메일을 사용한다.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @ApiProperty({
    example: true,
    description:
      '문의 처리 목적의 개인정보 수집·이용 동의. true가 아니면 400 — 동의 없이는 접수하지 않는다.',
  })
  @IsBoolean()
  @Equals(true)
  privacyConsent!: boolean;
}

export class ListInquiriesDto {
  @ApiPropertyOptional({ description: '1-based', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** 목록 항목 — body·answerBody 전문을 싣지 않는다 (페이로드 절감). */
export class InquiryListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

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

export class InquiryListResponseDto {
  @ApiProperty({ type: [InquiryListItemDto] })
  items!: InquiryListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class InquiryResponseDto extends InquiryListItemDto {
  @ApiProperty()
  body!: string;

  @ApiProperty({ type: String, nullable: true })
  contactEmail!: string | null;

  @ApiProperty({ type: String, nullable: true })
  answerBody!: string | null;

  @ApiProperty({
    format: 'date-time',
    description: '개인정보 수집·이용 동의 시각',
  })
  privacyConsentAgreedAt!: string;

  @ApiProperty({ example: '2026-08-19', description: '동의 문구 버전' })
  privacyConsentVersion!: string;
}
