import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SATISFACTION_SURVEY_CAMPAIGN_KEY,
  SATISFACTION_SURVEY_MAX_PROMPT_SHOWS,
} from './surveys.constants';
import type {
  SatisfactionSurveyPromptStateDto,
  SatisfactionSurveyStatusDto,
  SubmitSatisfactionSurveyDto,
} from './dto/satisfaction-survey.dto';

@Injectable()
export class SurveysService {
  constructor(private readonly prisma: PrismaService) {}

  async getSatisfactionStatus(
    userId: string,
  ): Promise<SatisfactionSurveyStatusDto> {
    const [hasAnyMissionExecution, promptState, response] = await Promise.all([
      this.hasAnyMissionExecution(userId),
      this.prisma.surveyPromptState.findUnique({
        where: {
          userId_campaignKey: {
            userId,
            campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
          },
        },
      }),
      this.prisma.satisfactionSurveyResponse.findUnique({
        where: {
          userId_campaignKey: {
            userId,
            campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
          },
        },
        select: { createdAt: true },
      }),
    ]);

    return this.toStatus({
      hasAnyMissionExecution,
      shownCount: promptState?.shownCount ?? 0,
      submittedAt: response?.createdAt ?? null,
    });
  }

  async recordSatisfactionPromptShown(
    userId: string,
  ): Promise<SatisfactionSurveyPromptStateDto> {
    const status = await this.getSatisfactionStatus(userId);
    if (!status.shouldShowPrompt) {
      return {
        ...status,
        dismissedCount: await this.getDismissedCount(userId),
      };
    }

    const now = new Date();
    const promptState = await this.prisma.surveyPromptState.upsert({
      where: {
        userId_campaignKey: {
          userId,
          campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
        },
      },
      create: {
        userId,
        campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
        shownCount: 1,
        lastShownAt: now,
      },
      update: {
        shownCount: { increment: 1 },
        lastShownAt: now,
      },
    });

    return {
      ...this.toStatus({
        hasAnyMissionExecution: status.hasAnyMissionExecution,
        shownCount: promptState.shownCount,
        submittedAt: status.submittedAt ? new Date(status.submittedAt) : null,
      }),
      dismissedCount: promptState.dismissedCount,
    };
  }

  async recordSatisfactionPromptDismissed(
    userId: string,
  ): Promise<SatisfactionSurveyPromptStateDto> {
    const status = await this.getSatisfactionStatus(userId);
    const promptState = await this.prisma.surveyPromptState.upsert({
      where: {
        userId_campaignKey: {
          userId,
          campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
        },
      },
      create: {
        userId,
        campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
        dismissedCount: 1,
      },
      update: {
        dismissedCount: { increment: 1 },
      },
    });

    return {
      ...this.toStatus({
        hasAnyMissionExecution: status.hasAnyMissionExecution,
        shownCount: promptState.shownCount,
        submittedAt: status.submittedAt ? new Date(status.submittedAt) : null,
      }),
      dismissedCount: promptState.dismissedCount,
    };
  }

  async submitSatisfactionSurvey(
    userId: string,
    dto: SubmitSatisfactionSurveyDto,
  ) {
    try {
      const response = await this.prisma.satisfactionSurveyResponse.create({
        data: {
          userId,
          campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
          discoverySource: dto.discoverySource,
          experienceRating: dto.experienceRating,
          likedOptions: dto.likedOptions,
          improvementText: normalizeOptionalText(dto.improvementText),
          contact: normalizeOptionalText(dto.contact),
        },
      });

      return {
        id: response.id,
        campaignKey: response.campaignKey,
        createdAt: response.createdAt.toISOString(),
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SURVEY_ALREADY_SUBMITTED',
          message: 'Survey response already exists for this campaign.',
        });
      }
      throw e;
    }
  }

  private async hasAnyMissionExecution(userId: string): Promise<boolean> {
    const execution = await this.prisma.missionExecution.findFirst({
      where: { userId },
      select: { id: true },
    });
    return Boolean(execution);
  }

  private async getDismissedCount(userId: string): Promise<number> {
    const state = await this.prisma.surveyPromptState.findUnique({
      where: {
        userId_campaignKey: {
          userId,
          campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
        },
      },
      select: { dismissedCount: true },
    });
    return state?.dismissedCount ?? 0;
  }

  private toStatus(input: {
    hasAnyMissionExecution: boolean;
    shownCount: number;
    submittedAt: Date | null;
  }): SatisfactionSurveyStatusDto {
    return {
      campaignKey: SATISFACTION_SURVEY_CAMPAIGN_KEY,
      hasAnyMissionExecution: input.hasAnyMissionExecution,
      shouldShowPrompt:
        input.hasAnyMissionExecution &&
        !input.submittedAt &&
        input.shownCount < SATISFACTION_SURVEY_MAX_PROMPT_SHOWS,
      promptShownCount: input.shownCount,
      maxPromptShows: SATISFACTION_SURVEY_MAX_PROMPT_SHOWS,
      submittedAt: input.submittedAt?.toISOString() ?? null,
    };
  }
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
