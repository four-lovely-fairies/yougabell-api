import { Gender } from '@prisma/client';

export type UpdateChildBody = {
  name?: string;
  birthDate?: string;
  gender?: Gender;
  notes?: string | null;
  displayOrder?: number;
};

export type ChildResponse = {
  id: string;
  name: string;
  birthDate: string;
  gender: Gender;
  notes: string | null;
  avatarUrl: string | null;
  displayOrder: number;
};
