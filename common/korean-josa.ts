/**
 * 한국어 조사 선택 유틸.
 *
 * 아이 이름처럼 사용자가 입력한 값을 문장에 끼워 넣을 때, 받침 유무에 따라
 * 조사를 골라준다. ("유더랑" / "지훈이랑", "유더와" / "지훈과")
 */

/**
 * 조사 쌍. **`받침없음/받침있음` 순서**로 표기한다.
 *
 * @example withJosa('유더', '랑/이랑') // '유더랑'
 * @example withJosa('지훈', '랑/이랑') // '지훈이랑'
 */
export type JosaPair =
  | '와/과'
  | '랑/이랑'
  | '가/이'
  | '를/을'
  | '는/은'
  | '야/아'
  | '로/으로';

type Jongseong = 'none' | 'rieul' | 'other';

const HANGUL_START = 0xac00; // '가'
const HANGUL_END = 0xd7a3; // '힣'
const JONGSEONG_COUNT = 28;
const RIEUL_JONGSEONG_INDEX = 8; // 종성 ㄹ

/** 한국어로 읽었을 때 숫자의 종성 (영·일·이·삼·사·오·육·칠·팔·구) */
const DIGIT_JONGSEONG: Record<string, Jongseong> = {
  '0': 'other', // 영 → ㅇ
  '1': 'rieul', // 일 → ㄹ
  '2': 'none', // 이
  '3': 'other', // 삼 → ㅁ
  '4': 'none', // 사
  '5': 'none', // 오
  '6': 'other', // 육 → ㄱ
  '7': 'rieul', // 칠 → ㄹ
  '8': 'rieul', // 팔 → ㄹ
  '9': 'none', // 구
};

/**
 * `로/으로`만 ㄹ받침을 받침 없음처럼 다룬다. ("서울로", "지훈으로")
 * 나머지 조사는 ㄹ받침도 일반 받침과 동일.
 */
const JOSA_FORMS: Record<
  JosaPair,
  { none: string; rieul: string; other: string }
> = {
  '와/과': { none: '와', rieul: '과', other: '과' },
  '랑/이랑': { none: '랑', rieul: '이랑', other: '이랑' },
  '가/이': { none: '가', rieul: '이', other: '이' },
  '를/을': { none: '를', rieul: '을', other: '을' },
  '는/은': { none: '는', rieul: '은', other: '은' },
  '야/아': { none: '야', rieul: '아', other: '아' },
  '로/으로': { none: '로', rieul: '로', other: '으로' },
};

/**
 * 단어 마지막 글자의 종성을 판별한다.
 *
 * 한글 음절과 숫자만 다루고, 그 밖의 문자(로마자·기호 등)로 끝나면 받침 없음으로
 * 간주한다 — 영문 이름의 실제 발음까지 추정하지는 않는다.
 */
const resolveJongseong = (word: string): Jongseong => {
  const last = word.trim().at(-1);
  if (!last) {
    return 'none';
  }

  const code = last.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) {
    const index = (code - HANGUL_START) % JONGSEONG_COUNT;
    if (index === 0) {
      return 'none';
    }
    return index === RIEUL_JONGSEONG_INDEX ? 'rieul' : 'other';
  }

  return DIGIT_JONGSEONG[last] ?? 'none';
};

/** 단어에 붙일 조사만 고른다. */
export const pickJosa = (word: string, pair: JosaPair): string =>
  JOSA_FORMS[pair][resolveJongseong(word)];

/** 단어에 알맞은 조사를 붙여 반환한다. */
export const withJosa = (word: string, pair: JosaPair): string =>
  `${word}${pickJosa(word, pair)}`;
