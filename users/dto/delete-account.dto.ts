import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountDeletionReasonCode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** DELETE /me — 계정 탈퇴 (Figma 2395:8988). soft delete. */
export class DeleteAccountDto {
  @ApiPropertyOptional({
    description:
      '탈퇴 사유 선택값 (선택). 보내면 AccountDeletionReason에 한 줄 저장한다.',
    enum: AccountDeletionReasonCode,
    enumName: 'AccountDeletionReasonCode',
  })
  @IsOptional()
  @IsEnum(AccountDeletionReasonCode)
  reasonCode?: AccountDeletionReasonCode;

  @ApiPropertyOptional({
    description: '탈퇴 사유 직접 입력 (선택, 자유 텍스트). 통계·CS 용도.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
