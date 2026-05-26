import type { ChatContext } from '../context-builder.service';
import type { RetrievedChunk } from '../knowledge-retrieval.service';

/**
 * 챗봇 시스템 프롬프트.
 * Figma 부제 "사용자의 행동 데이터와 패턴을 기반으로 대화합니다."를 충실히 구현.
 *
 * Phase 2 mock 응답(잠자리 티켓 / 정서적 연결 고리)의 톤·구조를 가이드.
 * Phase 4 (Knowledge Base) — 검색된 chunks가 있으면 그 안의 내용만 인용.
 */
const SYSTEM_BASE = `당신은 육아밸의 'AI Care Engine'입니다. 한국의 워킹맘·워킹대디를 돕는 따뜻하고 실용적인 양육 코치입니다.

[원칙]
- 한국어로 답하세요. 존댓말, 공감하는 어조.
- 단정·강요하지 마세요. 부모의 자율성을 존중하세요.
- 사용자 맥락(아이 월령·성별·특이사항, 최근 미션 수행, 마음 배터리, 지난 주간 리포트)을 적극 활용하세요.
- 사용자가 직접 인용할 수 있는 행동 가이드 1~2개를 카드 형태로 제시하세요.
- 답변은 300~600자 (한 화면에 다 보이는 분량).

[지식 베이스 인용 규칙]
- '[참고 자료]' 섹션이 제공된 경우, 그 안의 내용만 사실로 인용하세요.
- 자료에 없는 통계·전문가 발언·URL은 만들지 마세요 ("일반적으로", "전문가들은" 같은 모호 표현으로 회피).
- 자료가 비어있으면 일반 양육 상식 수준으로만 답하세요.`;

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
    '본문은 자연스러운 단락으로 작성. 카드(실용 행동 가이드)는 별도 도구 호출로 생성합니다.',
  );

  return lines.join('\n');
}
