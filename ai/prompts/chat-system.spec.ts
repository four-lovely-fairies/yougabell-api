import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatContext } from '../context-builder.service';
import type { RetrievedChunk } from '../knowledge-retrieval.service';
import {
  SYSTEM_PROMPT_SECTION_MARKERS,
  buildChatSystemPrompt,
} from './chat-system';

const context: ChatContext = {
  user: { name: '츠 은', workStatus: 'working' },
  children: [
    { name: '째이', ageMonths: 10, gender: 'female', notes: null },
    { name: '두리', ageMonths: 38, gender: 'male', notes: '땅콩 알레르기' },
  ],
  recentMissions: [
    {
      title: '까꿍 놀이',
      status: 'completed',
      completedAt: '2026-08-11T00:00:00.000Z',
      feedback: { childReaction: 5, parentEnergy: 7, childKeywords: ['웃음'] },
    },
  ],
  recentBatteryLevels: [{ level: 3, checkedAt: '2026-08-11T00:00:00.000Z' }],
  lastWeeklyReport: {
    weekStart: '2026-08-04',
    headline: '차분한 한 주',
    topKeywords: ['수면', '놀이'],
    psychologicalEnergy: 62,
  },
};

const chunks: RetrievedChunk[] = [
  {
    chunkId: 'c1',
    documentId: 'd1',
    chunkIndex: 0,
    text: '9개월 발달 마일스톤 본문',
    similarity: 0.8,
    source: 'cdc',
    sourceUrl: 'https://example.com/9mo',
    title: '9개월 발달 마일스톤',
    license: 'Public Domain (CDC)',
  },
];

/** 프롬프트가 실제로 출력하는 `[...]` 섹션 헤더 줄만 뽑는다. */
function sectionHeaders(prompt: string): string[] {
  return prompt
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[') && line.endsWith(']'));
}

/**
 * 절단 마커에서 의도적으로 제외한 헤더.
 * `[참고 자료]`는 본문 인용 표기 제거 로직과 충돌해 마커로 쓸 수 없다
 * (`chat-sanitize.ts` 참고). 여기 등록해 "빠뜨린 것"과 구분한다.
 */
const INTENTIONALLY_UNMARKED = ['[참고 자료]'];

void describe('buildChatSystemPrompt — 섹션 마커 동기화', () => {
  // 2026-08-12 누출 사고의 근본 재발 방지 장치.
  // 프롬프트에 섹션을 추가하고 SYSTEM_PROMPT_SECTION_MARKERS 갱신을 잊으면
  // sanitizer가 그 섹션을 못 걸러 사용자 화면에 그대로 노출된다.
  void it('모든 섹션 헤더가 마커에 등록돼 있다 (누락 시 sanitizer가 못 막음)', () => {
    for (const prompt of [
      buildChatSystemPrompt(context, chunks),
      buildChatSystemPrompt(context, []),
    ]) {
      for (const header of sectionHeaders(prompt)) {
        const covered =
          SYSTEM_PROMPT_SECTION_MARKERS.some((marker) =>
            header.startsWith(marker),
          ) || INTENTIONALLY_UNMARKED.includes(header);

        assert.ok(
          covered,
          `섹션 '${header}'가 SYSTEM_PROMPT_SECTION_MARKERS에 없다. ` +
            `추가하지 않으면 누출 시 sanitizer가 걸러내지 못한다. ` +
            `(web lib/chat-sanitize.ts도 함께 갱신할 것)`,
        );
      }
    }
  });

  void it('자녀·미션·배터리·리포트 컨텍스트가 프롬프트에 반영된다', () => {
    const prompt = buildChatSystemPrompt(context, chunks);
    assert.ok(prompt.includes('째이'));
    assert.ok(prompt.includes('땅콩 알레르기'));
    assert.ok(prompt.includes('까꿍 놀이'));
    assert.ok(prompt.includes('차분한 한 주'));
  });
});

// 2026-08-12 사고의 근본 원인 — 아래 두 규칙이 서로 모순됐다.
//   본문 규칙: "구체적 실천 단계는 전부 카드로만 생성. 본문에 풀어쓰지 마세요"
//   카드 규칙: "본문에 없는 내용을 카드로 만들지 마세요"
// → 본문에 실천 단계가 없으니 추출할 것도 없어 카드 0건.
// → 모델은 "곧 카드로 안내할게요"라고 예고했고, 사용자가 4번 되묻자 지시문을 뱉었다.
void describe('buildChatSystemPrompt — 본문 자기완결 원칙', () => {
  void it('본문만으로 답이 완결되어야 한다고 지시한다', () => {
    const prompt = buildChatSystemPrompt(context, []);
    assert.ok(prompt.includes('본문만 읽어도 답이 완결되어야'));
  });

  void it('뒤에 무언가 온다는 예고를 금지한다', () => {
    const prompt = buildChatSystemPrompt(context, []);
    assert.ok(prompt.includes('예고하지 마세요'));
  });

  void it('실천 단계를 본문에서 빼라는 모순 지시가 없다', () => {
    const prompt = buildChatSystemPrompt(context, []);
    assert.ok(!prompt.includes('전부 카드로만 생성'));
    assert.ok(!prompt.includes('본문에 미리 풀어쓰거나 요약하지 마세요'));
  });
});
