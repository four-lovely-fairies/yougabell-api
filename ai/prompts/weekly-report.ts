import { z } from 'zod';

/**
 * 주간 리포트 AI 필드 3개 구조화 출력.
 * 기획 docs/features/20260525-ai-integration.md §3.2 Phase 3.
 *
 * - headlineBody: 격려 문장 1~2 문장 (헤드라인 카드 본문)
 * - bestMomentBodies: 각 best moment에 대해 사용자/자녀 맥락을 반영한 서사. order로 매칭
 * - aiActionSuggestion: "다음 행동 제안" 한 단락
 */
export const WeeklyReportAiSchema = z.object({
  headlineBody: z
    .string()
    .min(20)
    .max(300)
    .describe('격려·공감 한두 문장. 부담스럽지 않고 따뜻한 어조.'),
  bestMomentBodies: z
    .array(
      z.object({
        order: z
          .number()
          .int()
          .describe('best moment의 order — 입력 시드와 1:1 매칭'),
        body: z
          .string()
          .min(20)
          .max(300)
          .describe(
            '해당 놀이에서 아이가 보인 반응·키워드를 자연스럽게 녹인 서사 1~2 문장',
          ),
      }),
    )
    .max(5)
    .describe('best moment 시드 개수와 동일하거나 그보다 적게'),
  aiActionSuggestion: z
    .string()
    .min(30)
    .max(400)
    .describe('다음 한 주에 시도할 행동 제안 한 단락'),
});

export type WeeklyReportAiPayload = z.infer<typeof WeeklyReportAiSchema>;

export const WEEKLY_REPORT_SYSTEM_PROMPT = `당신은 육아밸의 'AI Care Engine'입니다. 워킹맘·워킹대디를 위한 따뜻한 양육 코치이자 회고 파트너입니다.

[역할]
- 한 주간 부모와 아이의 상호작용 데이터를 받아 주간 리포트의 정성적 필드 3가지를 작성합니다.
  · headlineBody — 격려/공감 카드 본문
  · bestMomentBodies — 각 best moment의 서사 (mission 효과 텍스트를 단순 인용하지 말고 아이 반응·키워드를 녹여 재구성)
  · aiActionSuggestion — 다음 한 주의 구체적 행동 제안

[원칙]
- 한국어, 존댓말, 공감하는 어조.
- 단정하지 마세요. 과장·평가도 금지.
- 사용자 컨텍스트(자녀 월령·성별, 놀이 수행·피드백·키워드, 마음 배터리)를 적극 활용하세요.
- 본문에 출처 표시·URL 금지 (정성적 카피만).
- best moment 시드의 order를 그대로 사용해 출력 array에 매칭하세요. 없는 order를 만들지 마세요.`;

export type WeeklyReportPromptInput = {
  child: { name: string; ageMonths: number; gender: string };
  totalMissionDurationSeconds: number;
  childPositiveReactionRate: number; // 0..1
  psychologicalEnergy: number; // 0..100
  topKeywords: string[];
  bestMomentSeeds: Array<{
    order: number;
    title: string;
    label: string | null;
    childKeywords: string[];
    childReaction: number | null;
  }>;
};

export function buildWeeklyReportPrompt(
  input: WeeklyReportPromptInput,
): string {
  const lines = ['[이번 주 요약 데이터]'];
  const ageYears = Math.floor(input.child.ageMonths / 12);
  const ageMonthsRem = input.child.ageMonths % 12;
  const ageLabel =
    ageYears > 0
      ? `만${ageYears}세 ${ageMonthsRem}개월`
      : `${input.child.ageMonths}개월`;
  lines.push(
    `- 자녀: ${input.child.name} (${ageLabel}, ${input.child.gender})`,
  );
  lines.push(
    `- 누적 놀이 수행시간: ${Math.round(input.totalMissionDurationSeconds / 60)}분`,
  );
  lines.push(
    `- 아이 긍정 반응률: ${Math.round(input.childPositiveReactionRate * 100)}%`,
  );
  lines.push(`- 부모 심리 에너지: ${input.psychologicalEnergy}%`);
  lines.push(
    `- 아이 주요 키워드: ${input.topKeywords.length ? input.topKeywords.join(', ') : '(아직 없음)'}`,
  );

  lines.push('', '[Best Moment 시드 — 각 order에 맞춰 body를 작성하세요]');
  for (const seed of input.bestMomentSeeds) {
    const reactionLabel =
      seed.childReaction !== null ? ` · 아이반응 ${seed.childReaction}/5` : '';
    const keywordLabel = seed.childKeywords.length
      ? ` · 키워드: ${seed.childKeywords.join(', ')}`
      : '';
    lines.push(
      `  · order=${seed.order} · 제목: "${seed.title}"${seed.label ? ` · 라벨: ${seed.label}` : ''}${reactionLabel}${keywordLabel}`,
    );
  }
  if (input.bestMomentSeeds.length === 0) {
    lines.push('  · (이번 주는 best moment 없음 — bestMomentBodies는 빈 배열)');
  }

  return lines.join('\n');
}
