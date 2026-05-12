import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Gender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../home/home-date.utils';
import { ChildResponse, UpdateChildBody } from './children.types';

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async updateChild(
    userId: string,
    childId: string,
    body: UpdateChildBody,
  ): Promise<ChildResponse> {
    await this.assertActiveChild(userId, childId);

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: toUpdateData(body),
    });

    return toChildResponse(updated);
  }

  async deleteChild(userId: string, childId: string): Promise<void> {
    await this.assertActiveChild(userId, childId);

    const activeChildrenCount = await this.prisma.child.count({
      where: { userId, deletedAt: null },
    });
    if (activeChildrenCount <= 1) {
      throw new ConflictException({
        code: 'LAST_CHILD_CANNOT_BE_DELETED',
        message: 'The last child profile cannot be deleted.',
      });
    }

    await this.prisma.child.update({
      where: { id: childId },
      data: { deletedAt: new Date() },
    });
  }

  private async assertActiveChild(userId: string, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        userId,
        deletedAt: null,
      },
    });

    if (!child) {
      throw new NotFoundException({
        code: 'CHILD_NOT_FOUND',
        message: 'Child not found.',
      });
    }

    return child;
  }
}

function toUpdateData(body: UpdateChildBody) {
  const data: {
    name?: string;
    birthDate?: Date;
    gender?: Gender;
    notes?: string | null;
    displayOrder?: number;
  } = {};

  if (body.name !== undefined) {
    if (!body.name.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'name cannot be empty.',
      });
    }
    data.name = body.name.trim();
  }

  if (body.birthDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'birthDate must be YYYY-MM-DD.',
      });
    }
    data.birthDate = new Date(`${body.birthDate}T00:00:00+09:00`);
  }

  if (body.gender !== undefined) {
    if (body.gender !== 'female' && body.gender !== 'male') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'gender must be female or male.',
      });
    }
    data.gender = body.gender;
  }

  if (body.notes !== undefined) {
    data.notes = body.notes;
  }

  if (body.displayOrder !== undefined) {
    if (!Number.isInteger(body.displayOrder) || body.displayOrder < 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'displayOrder must be a non-negative integer.',
      });
    }
    data.displayOrder = body.displayOrder;
  }

  return data;
}

function toChildResponse(child: {
  id: string;
  name: string;
  birthDate: Date;
  gender: Gender;
  notes: string | null;
  avatarUrl: string | null;
  displayOrder: number;
}): ChildResponse {
  return {
    id: child.id,
    name: child.name,
    birthDate: toDateOnly(child.birthDate),
    gender: child.gender,
    notes: child.notes,
    avatarUrl: child.avatarUrl,
    displayOrder: child.displayOrder,
  };
}
