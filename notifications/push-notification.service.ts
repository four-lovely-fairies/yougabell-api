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

type PushTicket = {
  token: string;
  status: 'ok' | 'error';
  // Expo 티켓의 details.error (예: 'DeviceNotRegistered') 또는 전송 실패 사유
  error?: string;
  message?: string;
};

// 진단용 상세 결과. 어느 토큰이 왜 실패했는지(죽은 토큰 등)를 그대로 노출한다.
type PushDetailedResult = PushResult & {
  tickets: PushTicket[];
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private fetcher: FetchLike = fetch;

  constructor(@Inject(PrismaService) private readonly prisma: PushPrisma) {}

  async sendToUser(input: PushInput): Promise<PushResult> {
    const { attempted, sent, failed } = await this.sendToUserDetailed(input);
    return { attempted, sent, failed };
  }

  // 발송 결과를 토큰 단위로 반환한다. 수동 트리거·진단에서 사용:
  // attempted:0 → 토큰 미등록 / sent:0 → 죽은 토큰 / sent>0 → 토큰 정상.
  async sendToUserDetailed(input: PushInput): Promise<PushDetailedResult> {
    const tokens = await this.prisma.userPushToken.findMany({
      where: { userId: input.userId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, tickets: [] };
    }

    const tickets: PushTicket[] = [];

    for (let index = 0; index < tokens.length; index += EXPO_PUSH_BATCH_SIZE) {
      const batch = tokens.slice(index, index + EXPO_PUSH_BATCH_SIZE);
      const batchTokens = batch.map(({ token }) => token);
      const batchTickets = await this.sendBatch(
        batchTokens,
        batchTokens.map((token) => ({
          to: token,
          title: input.title,
          body: input.body,
          sound: 'default',
          data: input.data,
        })),
      );

      tickets.push(...batchTickets);
    }

    const sent = tickets.filter((ticket) => ticket.status === 'ok').length;

    return {
      attempted: tokens.length,
      sent,
      failed: tokens.length - sent,
      tickets,
    };
  }

  private async sendBatch(
    tokens: string[],
    messages: Array<Record<string, unknown>>,
  ): Promise<PushTicket[]> {
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
        return tokens.map((token) => ({
          token,
          status: 'error',
          error: `HTTP_${response.status}`,
        }));
      }

      const payload = (await response.json().catch(() => ({}))) as {
        data?: Array<{
          status?: string;
          message?: string;
          details?: { error?: string };
        }>;
      };
      const receipts = Array.isArray(payload.data) ? payload.data : [];

      return tokens.map((token, ticketIndex): PushTicket => {
        const receipt = receipts[ticketIndex];
        if (receipt?.status === 'ok') {
          return { token, status: 'ok' };
        }
        return {
          token,
          status: 'error',
          error: receipt?.details?.error ?? 'NO_RECEIPT',
          message: receipt?.message,
        };
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Expo push request threw: ${reason}`);
      return tokens.map((token) => ({
        token,
        status: 'error',
        error: 'REQUEST_FAILED',
        message: reason,
      }));
    }
  }
}
