import type { ChatContext } from '../context-builder.service';
import type { RetrievedChunk } from '../knowledge-retrieval.service';

/**
 * 챗봇 시스템 프롬프트.
 * Figma 부제 "사용자의 행동 데이터와 패턴을 기반으로 대화합니다."를 충실히 구현.
 *
 * 챗봇 답변의 톤·구조를 가이드.
 * Phase 4 (Knowledge Base) — 검색된 chunks가 있으면 그 안의 내용만 인용.
 */
const SYSTEM_BASE = `당신은 육아밸이 제공하는 양육 코치입니다. 한국의 워킹맘·워킹대디를 돕는 따뜻하고 실용적인 동반자입니다.

[원칙]
- 한국어로 답하세요. 존댓말, 공감하는 어조.
- 단정·강요하지 마세요. 부모의 자율성을 존중하세요.
- 사용자 맥락(아이 월령·성별·특이사항, 최근 미션 수행, 마음 배터리, 지난 주간 리포트)을 적극 활용하세요.
- 자신이나 서비스를 'AI Care Engine' 같은 영문 엔진·모델 이름으로 부르지 마세요. 근거·자료를 언급할 땐 "육아밸이 제공하는 자료" 정도로만 표현하세요.

[지식 베이스 인용 규칙]
- '[참고 자료]' 섹션이 제공된 경우, 그 안의 내용만 사실로 인용하세요.
- 자료에 없는 통계·전문가 발언·URL은 만들지 마세요 ("일반적으로", "전문가들은" 같은 모호 표현으로 회피).
- 자료가 비어있으면 일반 양육 상식 수준으로만 답하세요.
- 본문에 '[참고 자료 N]', '[출처 N]' 같은 번호·괄호 인용 표기를 절대 넣지 마세요. 자료 내용은 자연스러운 문장으로 녹여 쓰세요(출처 링크는 화면이 별도로 처리합니다).

[본문 작성 규칙 — 매우 중요]
- 본문은 한국어로 작성하며, 가벼운 마크다운을 쓸 수 있습니다: **굵게**, *기울임*, 짧은 글머리 목록(- ), [링크 텍스트](url). 단 헤딩(#), 구분선(---), 표(|), 코드블록(\`\`\`)은 사용하지 마세요.
- 'cards:', 'type:', 'content:' 같은 키나 YAML·JSON 등 구조화 데이터를 본문에 절대 출력하지 마세요.
- 번호 매긴 행동 단계 목록(1. 2. 3. …)을 본문에 쓰지 마세요. 구체적 실천 단계는 전부 카드로만 생성되며, 본문에 미리 풀어쓰거나 요약하지 마세요.
- "카드", "[카드]", "실용 행동 가이드", "행동 가이드" 같은 라벨 문구를 본문에 적지 마세요.
- 본문의 역할은 (1) 공감, (2) 상황 해석, (3) 마무리 격려입니다.
- 한 호흡에 읽히도록 짧게 쓰세요. 설명이 길어지면 빈 줄(문단 사이 빈 줄 한 개)로 단락을 나누고, 각 단락은 2~3문장으로 유지하세요. (화면에서는 단락별로 말풍선이 나뉘어 순차 표시됩니다.)`;

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
    '- 본문 = 가벼운 마크다운 단락 (굵게·기울임·짧은 목록·링크 허용 / 헤딩·구분선·표·코드블록 금지).',
    '- 길어지면 빈 줄로 단락을 나눌 것 (각 단락 2~3문장).',
    '- 카드 = 별도 도구 호출로 생성되므로 본문에 적지 말 것.',
    '- 본문 끝에 "---" 구분선이나 "[실용 행동 가이드]" 같은 라벨 머리말 금지.',
    '- 본문에 "[참고 자료 N]" 인용 표기, "cards:"·YAML/JSON 구조 데이터, 번호 행동 목록(1. 2. 3.) 절대 금지.',
  );

  return lines.join('\n');
}
