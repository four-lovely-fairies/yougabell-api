import { ConflictException, Injectable } from '@nestjs/common';
import { NotificationPreferenceType, Prisma } from '@prisma/client';
import { defaultNotificationTime } from '../notifications/notification-dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

const NOTIFICATION_TYPES: NotificationPreferenceType[] = [
  'play_10min',
  'weekly_report',
];

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 온보딩 일괄 완료 처리.
   * 첫 호출 시 도메인 User row를 lazy-create한다 (Supabase auth.users.id 기준).
   * 이미 완료(`onboardedAt != null`)된 사용자는 409.
   */
  async complete(userId: string, dto: CompleteOnboardingDto) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, onboardedAt: true, deletedAt: true },
      });

      if (user?.onboardedAt && !user.deletedAt) {
        throw new ConflictException({
          code: 'ONBOARDING_ALREADY_COMPLETED',
          onboardedAt: user.onboardedAt.toISOString(),
        });
      }

      const data = {
        name: dto.parent.name,
        birthDate: dto.parent.birthDate ? new Date(dto.parent.birthDate) : null,
        gender: dto.parent.gender ?? null,
        workStatus: dto.parent.workStatus ?? null,
        notificationSlot: dto.notification?.slot ?? null,
        notificationTime: dto.notification?.time ?? null,
        interests: dto.interests ?? [],
        onboardedAt: new Date(),
        deletedAt: null,
        deletionReason: null,
      };
      const createData: Prisma.UserUncheckedCreateInput = {
        id: userId,
        ...data,
      };
      const updateData: Prisma.UserUncheckedUpdateInput = data;

      if (user?.deletedAt) {
        await tx.child.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }

      await tx.user.upsert({
        where: { id: userId },
        create: createData,
        update: updateData,
      });

      for (const type of NOTIFICATION_TYPES) {
        await tx.notificationPreference.upsert({
          where: { userId_type: { userId, type } },
          create: {
            userId,
            type,
            enabled: Boolean(dto.notification),
            time:
              type === 'play_10min'
                ? resolvePlayNotificationTime(dto.notification)
                : defaultNotificationTime(type),
          },
          update: {
            enabled: Boolean(dto.notification),
            time:
              type === 'play_10min'
                ? resolvePlayNotificationTime(dto.notification)
                : defaultNotificationTime(type),
          },
        });
      }

      await tx.child.createMany({
        data: dto.children.map((c, idx) => ({
          userId,
          name: c.name,
          birthDate: new Date(c.birthDate),
          gender: c.gender,
          notes: c.notes ?? null,
          displayOrder: idx,
        })),
      });

      return this.getMe(tx, userId);
    });
  }

  /**
   * 트랜잭션 또는 일반 prisma client 모두에서 호출 가능한 me 조회.
   * 도메인 row가 아직 없는(가입 직후 미온보딩) 사용자도 200을 받도록 placeholder 반환.
   * onboardedAt: null이 미완료 신호 — 클라이언트는 이걸로 /onboarding 리디렉트한다.
   */
  async getMe(
    client:
      | PrismaService
      | Omit<Prisma.TransactionClient, '$connect' | '$disconnect'>,
    userId: string,
  ) {
    const me = await client.user.findUnique({
      where: { id: userId },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        notificationPreferences: { orderBy: { type: 'asc' } },
      },
    });
    if (me && !me.deletedAt) return me;

    if (me?.deletedAt) {
      return {
        id: userId,
        name: null,
        birthDate: null,
        gender: null,
        workStatus: null,
        notificationSlot: null,
        notificationTime: null,
        interests: [],
        onboardedAt: null,
        parentingStyleId: null,
        deletedAt: me.deletedAt,
        deletionReason: me.deletionReason,
        createdAt: me.createdAt,
        updatedAt: me.updatedAt,
        children: [],
        notificationPreferences: [],
      };
    }

    return {
      id: userId,
      name: null,
      birthDate: null,
      gender: null,
      workStatus: null,
      notificationSlot: null,
      notificationTime: null,
      interests: [],
      onboardedAt: null,
      parentingStyleId: null,
      deletedAt: null,
      deletionReason: null,
      createdAt: null,
      updatedAt: null,
      children: [],
      notificationPreferences: [],
    };
  }
}

function resolvePlayNotificationTime(
  notification: CompleteOnboardingDto['notification'],
): string {
  if (notification?.time) {
    return notification.time;
  }

  switch (notification?.slot) {
    case 'morning':
      return '08:00';
    case 'afternoon':
      return '12:00';
    case 'evening':
      return '18:00';
    case 'night':
      return '22:00';
    case 'custom':
      return '08:00';
    default:
      return defaultNotificationTime('play_10min');
  }
}
