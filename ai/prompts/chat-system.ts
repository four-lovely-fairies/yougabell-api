import type { ChatContext } from '../context-builder.service';
import type { RetrievedChunk } from '../knowledge-retrieval.service';

/**
 * 챗봇 시스템 프롬프트.
 * Figma 부제 "사용자의 행동 데이터와 패턴을 기반으로 대화합니다."를 충실히 구현.
 *
 * 챗봇 답변의 톤·구조를 가이드.
 * Phase 4 (Knowledge Base) — 검색된 chunks가 있으면 그 안의 내용만 인용.
 */
const SYSTEM_BASE = `당신은 육아밸의 'AI Care Engine'입니다. 한국의 워킹맘·워킹대디를 돕는 따뜻하고 실용적인 양육 코치입니다.

[원칙]
- 한국어로 답하세요. 존댓말, 공감하는 어조.
- 단정·강요하지 마세요. 부모의 자율성을 존중하세요.
- 사용자 맥락(아이 월령·성별·특이사항, 최근 미션 수행, 마음 배터리, 지난 주간 리포트)을 적극 활용하세요.

[지식 베이스 인용 규칙]
- '[참고 자료]' 섹션이 제공된 경우, 그 안의 내용만 사실로 인용하세요.
- 자료에 없는 통계·전문가 발언·URL은 만들지 마세요 ("일반적으로", "전문가들은" 같은 모호 표현으로 회피).
- 자료가 비어있으면 일반 양육 상식 수준으로만 답하세요.

[본문 작성 규칙 — 매우 중요]
- 본문은 plain text 한국어 단락만 출력하세요. 마크다운 문법 절대 사용 금지: **굵게**, ### 헤딩, --- 구분선, * - 머리표, [대괄호 마커] 모두 금지.
- "카드", "[카드]", "실용 행동 가이드", "행동 가이드" 같은 라벨 문구를 본문에 적지 마세요. 구체적 실천 항목을 본문에 풀어쓰지 마세요.
- 본문의 역할은 (1) 공감 한 문장, (2) 상황 해석 한 단락, (3) 마무리 격려 한 문장. 그게 전부입니다.
- 본문 길이는 150~300자 (3~5문장). 한 화면에서 가볍게 읽히는 분량.
- 구체적 행동 가이드는 별도 도구 호출(cards)로만 생성됩니다. 본문에서는 카드 내용을 미리 말하거나 요약하지 마세요.`;

export function buildChatSystemPrompt(
  context: ChatContext,
  retrievedChunks: RetrievedChunk[] = [],
): string {
  const lines = [SYSTEM_BASE, '', '[사용자 컨텍스트]'];

  lines.push(
    `- 부모: ${context.user.name}${context.user.workStatus ? ` (${context.user.workStatus})` : ''}`,
  );

  if (context.children.length > 0) {
    lines.push('- 자녀:');
    for (const child of context.children) {
      const ageYears = Math.floor(child.ageMonths / 12);
      const ageMonthsRem = child.ageMonths % 12;
      const ageLabel =
        ageYears > 0
          ? `만${ageYears}세 ${ageMonthsRem}개월`
          : `${child.ageMonths}개월`;
      lines.push(
        `  · ${child.name} — ${ageLabel}, ${child.gender}${child.notes ? `, 특이사항: ${child.notes}` : ''}`,
      );
    }
  }

  if (context.recentMissions.length > 0) {
    lines.push(`- 최근 ${context.recentMissions.length}건 미션 수행:`);
    for (const mission of context.recentMissions.slice(0, 5)) {
      const reaction = mission.feedback?.childReaction;
      const reactionLabel =
        typeof reaction === 'number' ? ` (아이반응 ${reaction}/5)` : '';
      lines.push(`  · "${mission.title}" — ${mission.status}${reactionLabel}`);
    }
    if (context.recentMissions.length > 5) {
      lines.push(`  · (외 ${context.recentMissions.length - 5}건)`);
    }
  }

  if (context.recentBatteryLevels.length > 0) {
    const avg =
      context.recentBatteryLevels.reduce((sum, b) => sum + b.level, 0) /
      context.recentBatteryLevels.length;
    lines.push(
      `- 최근 7일 마음 배터리 평균: ${avg.toFixed(1)}/5 (${context.recentBatteryLevels.length}회 기록)`,
    );
  }

  if (context.lastWeeklyReport) {
    lines.push(
      `- 지난 주간 리포트: "${context.lastWeeklyReport.headline}" / 키워드: ${context.lastWeeklyReport.topKeywords.join(', ') || '없음'} / 심리 에너지 ${context.lastWeeklyReport.psychologicalEnergy}%`,
    );
  }

  if (retrievedChunks.length > 0) {
    lines.push('', '[참고 자료]');
    retrievedChunks.forEach((chunk, index) => {
      lines.push(
        `${index + 1}. (${chunk.source} · ${chunk.title}) ${chunk.text.replace(/\s+/g, ' ').trim()}`,
      );
    });
  } else {
    lines.push('', '[참고 자료]', '(검색 결과 없음 — 일반 양육 상식 수준만)');
  }

  lines.push(
    '',
    '[답변 형식]',
    '- 본문 = plain text 단락 (마크다운·라벨 금지, 150~300자).',
    '- 카드 = 별도 도구 호출로 생성되므로 본문에 적지 말 것.',
    '- 본문 끝에 "---" 같은 구분자나 "[실용 행동 가이드]" 같은 머리말 절대 금지.',
  );

  return lines.join('\n');
}
