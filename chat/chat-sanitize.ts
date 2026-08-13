import { SYSTEM_PROMPT_LEAK_PATTERN } from '../ai/prompts/chat-system';

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
  let text = raw;

  // 1) 시스템 프롬프트 섹션 헤더가 나오면 그 지점부터 끝까지 버린다.
  //    헤더 앞의 정상 답변(있다면)은 살린다.
  const leakAt = text.search(SYSTEM_PROMPT_LEAK_PATTERN);
  if (leakAt >= 0) text = text.slice(0, leakAt);

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
