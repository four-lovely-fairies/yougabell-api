import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NotificationPreferenceType, Prisma } from '@prisma/client';
import { defaultNotificationTime } from '../notifications/notification-dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import type { UpdateParentDto } from './dto/update-parent.dto';
import type { UpdateInterestsDto } from './dto/update-interests.dto';
import type { UpsertNotificationPreferenceDto } from './dto/upsert-notification-preference.dto';
import type { DeleteAccountDto } from './dto/delete-account.dto';

/**
 * 설정(Settings) 도메인 — 온보딩 후 사용자가 자신의 데이터를 수정·삭제.
 * docs/features/20260519-settings.md 참조.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  /** PATCH /me/parent — 본인 정보 부분 갱신. */
  async updateParent(userId: string, dto: UpdateParentDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.gender !== undefined) data.gender = dto.gender;
    // workStatus는 null로 명시 해제 가능
    if (dto.workStatus !== undefined) data.workStatus = dto.workStatus;

    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('USER_NOT_FOUND');
      }
      throw e;
    }
    return this.onboarding.getMe(this.prisma, userId);
  }

  /** PATCH /me/interests — 관심 주제 일괄 교체. */
  async updateInterests(userId: string, dto: UpdateInterestsDto) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { interests: { set: dto.interests } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('USER_NOT_FOUND');
      }
      throw e;
    }
    return this.onboarding.getMe(this.prisma, userId);
  }

  /**
   * PATCH /me/notifications/:type — 알림 종류별 enabled + time upsert.
   * time 미지정 시 기존 row 보존, 없으면 09:00 기본값.
   */
  async upsertNotificationPreference(
    userId: string,
    type: NotificationPreferenceType,
    dto: UpsertNotificationPreferenceDto,
  ) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    const time = dto.time ?? existing?.time ?? defaultNotificationTime(type);
    return this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, enabled: dto.enabled, time },
      update: { enabled: dto.enabled, time },
    });
  }

  /**
   * DELETE /me — 계정 탈퇴 (soft delete).
   * deletedAt set. 실제 cascade hard delete는 cron(30일 후) 별도 작업.
   * 이미 탈퇴 처리된 사용자는 409.
   */
  async softDeleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    if (user.deletedAt) {
      throw new ConflictException({
        code: 'ACCOUNT_ALREADY_DELETED',
        deletedAt: user.deletedAt.toISOString(),
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletionReason: dto.reason ?? null,
      },
    });
  }
}
