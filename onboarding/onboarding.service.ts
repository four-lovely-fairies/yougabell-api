import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 온보딩 일괄 완료 처리.
   * Parent 정보 + Child[] + UserAppUsageSlot[]을 단일 트랜잭션으로 적용.
   * 이미 완료(`onboardedAt != null`)된 사용자는 409.
   */
  async complete(userId: string, dto: CompleteOnboardingDto) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, onboardedAt: true },
      });

      if (!user) {
        throw new NotFoundException({ code: 'USER_NOT_FOUND' });
      }

      if (user.onboardedAt) {
        throw new ConflictException({
          code: 'ONBOARDING_ALREADY_COMPLETED',
          onboardedAt: user.onboardedAt.toISOString(),
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.parent.name,
          birthDate: new Date(dto.parent.birthDate),
          gender: dto.parent.gender,
          workStatus: dto.parent.workStatus ?? null,
          onboardedAt: new Date(),
        },
      });

      await tx.child.createMany({
        data: dto.children.map((c, idx) => ({
          userId,
          name: c.name,
          birthDate: new Date(c.birthDate),
          gender: c.gender,
          notes: c.notes ?? null,
          displayOrder: idx, // 입력 순서대로. 추후 운영자/사용자가 재정렬 가능 (별도 기능).
        })),
      });

      const dedupedSlots = Array.from(
        new Map(
          dto.appUsage.map((s) => [`${s.dayOfWeek}:${s.slot}`, s]),
        ).values(),
      );
      if (dedupedSlots.length > 0) {
        await tx.userAppUsageSlot.createMany({
          data: dedupedSlots.map((s) => ({
            userId,
            dayOfWeek: s.dayOfWeek,
            slot: s.slot,
          })),
        });
      }

      return this.getMe(tx, userId);
    });
  }

  /**
   * 트랜잭션 또는 일반 prisma client 모두에서 호출 가능한 me 조회.
   */
  async getMe(
    client:
      | PrismaService
      | Omit<Prisma.TransactionClient, '$connect' | '$disconnect'>,
    userId: string,
  ) {
    const me = await client.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        children: { orderBy: { createdAt: 'asc' } },
        appUsageSlots: { orderBy: [{ dayOfWeek: 'asc' }, { slot: 'asc' }] },
      },
    });
    return me;
  }
}
