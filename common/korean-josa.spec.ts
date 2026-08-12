import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickJosa, withJosa } from './korean-josa';

void describe('korean-josa', () => {
  void it('받침 없는 이름에는 받침없음 조사를 붙인다', () => {
    assert.equal(withJosa('유더', '랑/이랑'), '유더랑');
    assert.equal(withJosa('유더', '와/과'), '유더와');
    assert.equal(withJosa('민수', '가/이'), '민수가');
    assert.equal(withJosa('민수', '를/을'), '민수를');
    assert.equal(withJosa('민수', '는/은'), '민수는');
    assert.equal(withJosa('민수', '야/아'), '민수야');
  });

  void it('받침 있는 이름에는 받침있음 조사를 붙인다', () => {
    assert.equal(withJosa('지훈', '랑/이랑'), '지훈이랑');
    assert.equal(withJosa('지훈', '와/과'), '지훈과');
    assert.equal(withJosa('지훈', '가/이'), '지훈이');
    assert.equal(withJosa('지훈', '를/을'), '지훈을');
    assert.equal(withJosa('지훈', '는/은'), '지훈은');
    assert.equal(withJosa('지훈', '야/아'), '지훈아');
  });

  void it('ㄹ받침은 로/으로에서만 받침 없음처럼 다룬다', () => {
    assert.equal(withJosa('서울', '로/으로'), '서울로');
    assert.equal(withJosa('부산', '로/으로'), '부산으로');
    assert.equal(withJosa('제주', '로/으로'), '제주로');

    // 나머지 조사에서 ㄹ받침은 일반 받침과 동일
    assert.equal(withJosa('하늘', '랑/이랑'), '하늘이랑');
    assert.equal(withJosa('하늘', '와/과'), '하늘과');
  });

  void it('숫자로 끝나면 한국어 발음의 종성을 따른다', () => {
    assert.equal(pickJosa('아이1', '가/이'), '이'); // 일
    assert.equal(pickJosa('아이2', '가/이'), '가'); // 이
    assert.equal(pickJosa('아이3', '가/이'), '이'); // 삼
    assert.equal(pickJosa('아이5', '가/이'), '가'); // 오
    assert.equal(pickJosa('아이6', '가/이'), '이'); // 육
    assert.equal(pickJosa('아이0', '가/이'), '이'); // 영
    assert.equal(pickJosa('아이7', '로/으로'), '로'); // 칠 → ㄹ받침
    assert.equal(pickJosa('아이6', '로/으로'), '으로'); // 육 → ㄱ받침
  });

  void it('한글·숫자가 아닌 문자로 끝나면 받침 없음으로 처리한다', () => {
    assert.equal(withJosa('Sam', '랑/이랑'), 'Sam랑');
    assert.equal(withJosa('아이!', '와/과'), '아이!와');
  });

  void it('앞뒤 공백은 판별에서 무시하되 원문은 보존한다', () => {
    assert.equal(pickJosa('지훈 ', '랑/이랑'), '이랑');
    assert.equal(withJosa('지훈 ', '랑/이랑'), '지훈 이랑');
  });

  void it('빈 문자열은 받침 없음으로 처리한다', () => {
    assert.equal(pickJosa('', '와/과'), '와');
  });
});
