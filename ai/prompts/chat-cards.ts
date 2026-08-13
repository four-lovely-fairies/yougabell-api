import { z } from 'zod';

/**
 * 챗 응답에 포함될 카드·출처 구조화 schema.
 * streamText로 본문을 받은 뒤 별도 generateObject 호출로 카드/출처 추출.
 *
 * Figma 디자인 (2395:12602) 기준: 어시스턴트 답변 하단에 2~3개의 카드 + 좌측 보라 경계선.
 */
export const ChatCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        title: z
          .string()
          .min(1)
          .max(40)
          .describe('짧고 인상적인 카드 제목, 예: "잠자리 티켓"'),
        body: z
          .string()
          .min(20)
          .max(400)
          .describe(
            '카드 본문 — 부모가 바로 시도할 수 있는 구체적 행동 가이드 1~2 문장',
          ),
      }),
    )
    .min(0)
    .max(3)
    .describe(
      '답변 본문 아래에 첨부할 행동 카드. 적합한 카드가 없으면 빈 배열.',
    ),
  sources: z
    .array(
      z.object({
        url: z.string().url(),
        domain: z.string(),
        title: z.string().nullable(),
      }),
    )
    .min(0)
    .max(3)
    .describe('답변에 인용한 외부 출처. 확실하지 않으면 빈 배열.'),
});

export type ChatCardsPayload = z.infer<typeof ChatCardsSchema>;

export const CHAT_CARDS_SYSTEM_PROMPT = `다음 챗 응답 본문에서 부모에게 실용적인 행동 카드 0~3개와, 본문에 인용된 외부 출처 0~3개를 추출하세요.

카드는 **본문에 이미 있는 실천 방법을 골라 담는 요약**입니다. 본문이 답을 완결하고, 카드는 그중 행동할 것만 다시 보여주는 보조 화면입니다.
- 카드는 "행동 단위"여야 합니다 (단순 격려는 카드로 만들지 않음).
- 본문에 없는 내용을 카드로 만들지 마세요.
- 본문이 공감·격려뿐이면 빈 배열이 정상입니다 — 억지로 만들지 마세요.
- 출처 URL은 본문에 명시적으로 언급된 경우에만 포함하세요. 추측 금지.
- 적합한 카드/출처가 없으면 빈 배열을 반환하세요.`;
