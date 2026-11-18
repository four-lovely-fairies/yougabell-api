import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, MaxLength } from 'class-validator';

export class CheckInviteCodeRequestDto {
  @ApiProperty({ example: 'YB4K2', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  code!: string;
}

export class InviteCodeCheckResponseDto {
  @ApiProperty() valid!: boolean;

  @ApiProperty({
    required: false,
    enum: ['not_found', 'self'],
    description: 'not_found = 없는 코드, self = 내 코드',
  })
  reason?: 'not_found' | 'self';
}

export class ReferralFriendDto {
  @ApiProperty({ example: '하윤맘' }) name!: string;
  @ApiProperty() joinedAt!: string;
}

export class ReferralRewardClaimDto {
  @ApiProperty({ example: '01012345678' }) phone!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) sentAt!: string | null;
}

export class MyReferralResponseDto {
  @ApiProperty({ example: 'YB4K2' }) code!: string;
  @ApiProperty({ example: 4 }) goal!: number;
  @ApiProperty({ example: 2 }) joinedCount!: number;
  @ApiProperty({ type: [ReferralFriendDto] }) friends!: ReferralFriendDto[];
  @ApiProperty({ description: '4명 달성 + 아직 쿠폰 신청 전' })
  rewardAvailable!: boolean;
  @ApiProperty({ type: ReferralRewardClaimDto, nullable: true })
  rewardClaim!: ReferralRewardClaimDto | null;
}

export class ClaimReferralRewardRequestDto {
  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ description: '[필수] 개인정보 수집·이용 동의. true만 허용.' })
  @Equals(true, { message: 'privacy consent is required' })
  privacyAgreed!: boolean;
}
