import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100;

type PushPrisma = Pick<PrismaService, 'userPushToken'>;
type FetchLike = typeof fetch;

type PushInput = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type PushResult = {
  attempted: number;
  sent: number;
  failed: number;
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private fetcher: FetchLike = fetch;

  constructor(@Inject(PrismaService) private readonly prisma: PushPrisma) {}

  async sendToUser(input: PushInput): Promise<PushResult> {
    const tokens = await this.prisma.userPushToken.findMany({
      where: { userId: input.userId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { attempted: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (let index = 0; index < tokens.length; index += EXPO_PUSH_BATCH_SIZE) {
      const batch = tokens.slice(index, index + EXPO_PUSH_BATCH_SIZE);
      const result = await this.sendBatch(
        batch.map(({ token }) => ({
          to: token,
          title: input.title,
          body: input.body,
          sound: 'default',
          data: input.data,
        })),
      );

      sent += result.sent;
      failed += result.failed;
    }

    return { attempted: tokens.length, sent, failed };
  }

  private async sendBatch(messages: Array<Record<string, unknown>>) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      const response = await this.fetcher(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(`Expo push request failed: ${response.status}`);
        return { sent: 0, failed: messages.length };
      }

      const payload = (await response.json().catch(() => ({}))) as {
        data?: Array<{ status?: string }>;
      };
      const tickets = Array.isArray(payload.data) ? payload.data : [];
      const sent = tickets.filter((ticket) => ticket.status === 'ok').length;

      return {
        sent,
        failed: messages.length - sent,
      };
    } catch (error) {
      this.logger.warn(
        `Expo push request threw: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { sent: 0, failed: messages.length };
    }
  }
}
