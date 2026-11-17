import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractChoices } from './chat-sanitize';

void describe('extractChoices', () => {
  void it('splits the trailing choices block from the body', () => {
    const { body, choices } = extractChoices(
      '밤에 자주 깨는 건 흔한 일이에요.\n어떤 모습에 더 가까운가요?\n[[선택지: 잠들 때까지 안아줘야 해요 | 새벽에 깨면 다시 못 자요 | 수면 루틴부터 같이 짜 줘]]',
    );
    assert.equal(
      body,
      '밤에 자주 깨는 건 흔한 일이에요.\n어떤 모습에 더 가까운가요?',
    );
    assert.deepEqual(choices, [
      '잠들 때까지 안아줘야 해요',
      '새벽에 깨면 다시 못 자요',
      '수면 루틴부터 같이 짜 줘',
    ]);
  });

  void it('keeps the reply as is without a block', () => {
    const raw = '이렇게 해 보세요.\n- 일정한 시간에 재우기';
    assert.deepEqual(extractChoices(raw), { body: raw, choices: [] });
  });

  void it('accepts a full-width colon, a missing closing bracket and caps at 4', () => {
    const { choices } = extractChoices(
      '질문\n[[선택지： 가 | 나 | 다 | 라 | 마',
    );
    assert.deepEqual(choices, ['가', '나', '다', '라']);
  });
});
