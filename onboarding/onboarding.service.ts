import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

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
        select: { id: true, onboardedAt: true },
      });

      if (user?.onboardedAt) {
        throw new ConflictException({
          code: 'ONBOARDING_ALREADY_COMPLETED',
          onboardedAt: user.onboardedAt.toISOString(),
        });
      }

      const data = {
        name: dto.parent.name,
        birthDate: new Date(dto.parent.birthDate),
        gender: dto.parent.gender,
        workStatus: dto.parent.workStatus ?? null,
        notificationSlot: dto.notification.slot,
        notificationTime: dto.notification.time ?? null,
        onboardedAt: new Date(),
      };
      const createData: Prisma.UserUncheckedCreateInput = {
        id: userId,
        ...data,
      };
      const updateData: Prisma.UserUncheckedUpdateInput = data;

      await tx.user.upsert({
        where: { id: userId },
        create: createData,
        update: updateData,
      });

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
        children: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (me) return me;

    return {
      id: userId,
      name: null,
      birthDate: null,
      gender: null,
      workStatus: null,
      notificationSlot: null,
      notificationTime: null,
      onboardedAt: null,
      parentingStyleId: null,
      createdAt: null,
      updatedAt: null,
      children: [],
    };
  }
}
