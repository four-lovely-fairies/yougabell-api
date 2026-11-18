import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PushNotificationService } from '../notifications/push-notification.service';
import { PrismaService } from '../prisma/prisma.service';

/** 쿠폰을 받기 위해 가입해야 하는 친구 수 */
export const REFERRAL_GOAL = 4;
// 알림에서 들어온 걸 로그(Referral Viewed entry=notification)로 구분하려고 from을 붙인다.
export const REFERRAL_PATH = '/referral?from=notification';

// 헷갈리는 글자(0/O, 1/I/L)는 뺀다 — 친구가 손으로 옮겨 적는 코드라서.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

export type InviteCodeCheck =
  | { valid: true }
  | { valid: false; reason: 'not_found' | 'self' };

type Tx = Omit<Prisma.TransactionClient, '$connect' | '$disconnect'>;

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function generateInviteCode(random: () => number = Math.random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** 숫자만 남긴 휴대폰 번호. 010으로 시작하는 10~11자리만 허용. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

export function inviterNotificationCopy(name: string, joinedCount: number) {
  if (joinedCount === REFERRAL_GOAL) {
    return {
      title: '커피 쿠폰이 도착했어요',
      body: `${name}님까지 친구 ${REFERRAL_GOAL}명이 모두 가입했어요. 쿠폰을 받아보세요!`,
    };
  }
  if (joinedCount < REFERRAL_GOAL) {
    return {
      title: '초대한 친구가 가입했어요',
      body: `${name}님이 내 초대 코드로 가입했어요. ${REFERRAL_GOAL - joinedCount}명만 더 초대하면 커피를 받아요.`,
    };
  }
  return {
    title: '초대한 친구가 가입했어요',
    body: `${name}님이 내 초대 코드로 가입했어요.`,
  };
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationService,
  ) {}

  /** 온보딩 초대 코드 화면의 [확인] — 가입 전에 코드만 확인한다. */
  async checkCode(userId: string, raw: string): Promise<InviteCodeCheck> {
    const code = normalizeInviteCode(raw);
    if (!code) return { valid: false, reason: 'not_found' };
    const owner = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, deletedAt: true },
    });
    if (!owner || owner.deletedAt) return { valid: false, reason: 'not_found' };
    if (owner.id === userId) return { valid: false, reason: 'self' };
    return { valid: true };
  }

  /** 내 초대 코드 — 없으면 이때 발급한다. */
  async getOrCreateCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user?.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateInviteCode();
      try {
        // 동시에 두 번 불려도 먼저 저장된 코드를 그대로 쓴다.
        const updated = await this.prisma.user.updateMany({
          where: { id: userId, referralCode: null },
          data: { referralCode: code },
        });
        if (updated.count === 0) {
          const again = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true },
          });
          if (again?.referralCode) return again.referralCode;
        } else {
          return code;
        }
      } catch (error) {
        // 코드가 겹치면(unique) 새로 뽑는다.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    throw new ConflictException({ code: 'REFERRAL_CODE_GENERATION_FAILED' });
  }

  async getMyReferral(userId: string) {
    const code = await this.getOrCreateCode(userId);
    const [referrals, claim] = await Promise.all([
      this.prisma.referral.findMany({
        where: { inviterId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          invitee: { select: { name: true, deletedAt: true } },
        },
      }),
      this.prisma.referralRewardClaim.findUnique({ where: { userId } }),
    ]);
    const friends = referrals.map((r) => ({
      name: r.invitee.deletedAt ? '탈퇴한 친구' : r.invitee.name,
      joinedAt: r.createdAt.toISOString(),
    }));
    return {
      code,
      goal: REFERRAL_GOAL,
      joinedCount: friends.length,
      friends,
      rewardAvailable: friends.length >= REFERRAL_GOAL && !claim,
      rewardClaim: claim
        ? {
            phone: claim.phone,
            createdAt: claim.createdAt.toISOString(),
            sentAt: claim.sentAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * 가입 완료(온보딩) 트랜잭션 안에서 호출. 처음 가입하는 사람만 인정한다.
   * 코드가 틀려도 가입은 막지 않는다 — 기록만 건너뛴다. 기록되면 초대한 사람 id를 돌려준다.
   */
  async recordSignup(
    tx: Tx,
    inviteeId: string,
    rawCode: string | undefined,
    isFirstSignup: boolean,
  ): Promise<string | null> {
    if (!rawCode || !isFirstSignup) return null;
    const code = normalizeInviteCode(rawCode);
    if (!code) return null;
    const inviter = await tx.user.findUnique({
      where: { referralCode: code },
      select: { id: true, deletedAt: true },
    });
    if (!inviter || inviter.deletedAt || inviter.id === inviteeId) return null;
    const existing = await tx.referral.findUnique({ where: { inviteeId } });
    if (existing) return null;
    await tx.referral.create({
      data: { inviterId: inviter.id, inviteeId, code },
    });
    return inviter.id;
  }

  /** 친구가 가입할 때마다 초대한 사람에게 알림(앱 안 알림 + 푸시). 실패해도 가입은 그대로. */
  async notifyInviter(inviterId: string, inviteeName: string): Promise<void> {
    try {
      const joinedCount = await this.prisma.referral.count({
        where: { inviterId },
      });
      const copy = inviterNotificationCopy(inviteeName, joinedCount);
      await this.prisma.notification.create({
        data: {
          userId: inviterId,
          type: 'referral_joined',
          title: copy.title,
          body: copy.body,
          actionType: 'url',
          targetType: 'url',
          targetUrl: REFERRAL_PATH,
          priority: joinedCount === REFERRAL_GOAL ? 'high' : 'normal',
        },
      });
      await this.push.sendToUser({
        userId: inviterId,
        title: copy.title,
        body: copy.body,
        data: {
          actionType: 'url',
          targetType: 'url',
          targetUrl: REFERRAL_PATH,
        },
      });
    } catch (error) {
      this.logger.warn(
        `친구 가입 알림 실패 (inviterId=${inviterId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * 08 쿠폰 받기 — 휴대폰 번호 입력. 4명 이상 가입했고 아직 신청 안 한 사람만.
   * 개인정보 수집·이용은 회원가입(약관) 때 필수로 받으므로 따로 받지 않는다.
   */
  async claimReward(userId: string, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE' });

    const joinedCount = await this.prisma.referral.count({
      where: { inviterId: userId },
    });
    if (joinedCount < REFERRAL_GOAL) {
      throw new BadRequestException({
        code: 'REFERRAL_GOAL_NOT_REACHED',
        joinedCount,
      });
    }
    const existing = await this.prisma.referralRewardClaim.findUnique({
      where: { userId },
    });
    if (existing)
      throw new ConflictException({ code: 'REWARD_ALREADY_CLAIMED' });

    const claim = await this.prisma.referralRewardClaim.create({
      data: {
        userId,
        phone,
        inviteCount: joinedCount,
      },
    });
    return {
      phone: claim.phone,
      createdAt: claim.createdAt.toISOString(),
      sentAt: null,
    };
  }
}
