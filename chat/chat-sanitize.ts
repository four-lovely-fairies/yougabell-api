import {
  SYSTEM_PROMPT_LEAK_PATTERN,
  SYSTEM_PROMPT_SECTION_MARKERS,
} from '../ai/prompts/chat-system';

/** `- ` · `· ` · `* ` · `1. ` · `1) ` — 프롬프트 섹션 본문의 형태. */
const LIST_LINE = /^(?:[-*·]|\d+[.)])\s/;

/**
 * 시스템 프롬프트 섹션만 골라 제거한다. **섹션 뒤에 이어지는 실제 답변은 살린다.**
 *
 * 2026-08-12 누출 메시지를 실측해보니 구조가 일정했다:
 *   `[헤더]` → 리스트/공백 줄 반복 → ... → **리스트가 아닌 산문 줄부터가 진짜 답변**
 * 실제로 그 메시지도 프롬프트 3,557자 뒤에 정상 답변 161자가 붙어 있었다.
 *
 * 그래서 "첫 마커부터 끝까지 절단"하면 답변까지 날아간다. 헤더를 만나면 그
 * 섹션(리스트·공백 줄)만 먹고, 산문 줄을 만나는 순간 제거를 멈춘다.
 *
 * 한계: 모델이 지시문을 **산문 형태로 풀어 쓰면** 이 규칙으로는 못 잡는다.
 * 그래서 `containsSystemPromptLeak` 감지·경고·카드 추출 차단을 함께 둔다.
 */
function stripPromptSections(raw: string): string {
  const kept: string[] = [];
  let inSection = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    const isHeader = SYSTEM_PROMPT_SECTION_MARKERS.some((marker) =>
      trimmed.startsWith(marker),
    );

    if (isHeader) {
      inSection = true;
      continue;
    }
    if (!inSection) {
      kept.push(line);
      continue;
    }
    // 섹션 안 — 리스트·공백 줄은 프롬프트 본문이므로 버린다.
    if (trimmed === '' || LIST_LINE.test(trimmed)) continue;
    // 산문 줄 = 섹션 종료. 여기부터가 실제 답변.
    inSection = false;
    kept.push(line);
  }

  return kept.join('\n');
}

/**
 * 모델 응답에서 "사용자에게 절대 보이면 안 되는 것"을 걷어낸다.
 *
 * 두 갈래의 누출을 막는다:
 *  1. **시스템 프롬프트 되뱉음** — 모델이 지시문을 답변으로 출력 (2026-08-12 실제 발생)
 *  2. **카드 구조 누출** — `cards:`/`type:`/`items:` 등 YAML·JSON 키
 *
 * `chat.service.ts`에서 분리 — 표시 정책이 커지면서 서비스 본체와 관심사가
 * 달라졌고, 파일 400줄 한도(AGENTS.md)도 함께 고려했다.
 */
export function sanitizeAssistantContent(raw: string): string {
  // 1) 시스템 프롬프트 섹션 제거 (뒤에 붙은 실제 답변은 보존).
  let text = stripPromptSections(raw);

  // 2) 구조 블록(cards:/type:/content:/items: 로 시작하는 줄) 누출 제거.
  // 본문 "맨 앞"에서 시작하는 경우(선행 개행 없음)까지 잡도록 `^|\n`로 앵커링하고,
  // 카드 항목 키 `items:`도 마커에 포함한다. 카드는 별도로 추출·렌더되므로
  // 본문에서는 누출만 걷어내며, 블록이 본문 전체면 빈 본문이 된다.
  text = text.replace(
    /(?:^|\n)[ \t]*-?[ \t]*(?:cards|type|title|content|items)[ \t]*:[\s\S]*$/i,
    '',
  );
  // 코드펜스 마커만 제거 (내용 보존). 챗 본문은 코드블록을 쓰지 않음.
  text = text.replace(/```[a-zA-Z0-9]*\n?/g, '');
  text = text.replace(/\s*\[\s*(?:참고\s*자료|참고자료|출처)[^\]]*\]/g, '');
  return text.replace(/[ \t]+\n/g, '\n').trim();
}

/**
 * 시스템 프롬프트 되뱉음 여부. true면 카드 추출을 건너뛴다 —
 * 지시문에서 뽑은 카드는 전부 쓰레기이고 토큰만 태운다.
 */
export function containsSystemPromptLeak(raw: string): boolean {
  return SYSTEM_PROMPT_LEAK_PATTERN.test(raw);
}
