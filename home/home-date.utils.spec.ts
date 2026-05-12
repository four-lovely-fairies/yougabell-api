import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonthTogetherDaysPercent,
  getAgeMonths,
  getAgeLabel,
  getWeekInfo,
} from './home-date.utils';

void describe('home date utilities', () => {
  void it('builds a Monday-to-Sunday week with Korean labels', () => {
    const week = getWeekInfo(new Date('2026-05-12T12:00:00+09:00'));

    assert.equal(week.monthLabel, '5월');
    assert.equal(week.weekOfMonthLabel, '2주차');
    assert.deepEqual(
      week.days.map((day) => `${day.weekdayLabel}${day.dayOfMonth}`),
      ['월11', '화12', '수13', '목14', '금15', '토16', '일17'],
    );
    assert.equal(week.days[1]?.isToday, true);
  });

  void it('uses the week containing the first Thursday as week 1', () => {
    const firstMayWeek = getWeekInfo(new Date('2026-05-04T12:00:00+09:00'));
    const previousMonthWeek = getWeekInfo(
      new Date('2026-05-01T12:00:00+09:00'),
    );

    assert.equal(firstMayWeek.monthLabel, '5월');
    assert.equal(firstMayWeek.weekOfMonthLabel, '1주차');
    assert.deepEqual(
      firstMayWeek.days.map((day) => day.date),
      [
        '2026-05-04',
        '2026-05-05',
        '2026-05-06',
        '2026-05-07',
        '2026-05-08',
        '2026-05-09',
        '2026-05-10',
      ],
    );

    assert.equal(previousMonthWeek.monthLabel, '4월');
    assert.equal(previousMonthWeek.weekOfMonthLabel, '5주차');
  });

  void it('calculates month progress from distinct completed mission dates', () => {
    const result = calculateMonthTogetherDaysPercent(
      [
        new Date('2026-05-01T09:00:00+09:00'),
        new Date('2026-05-01T10:00:00+09:00'),
        new Date('2026-05-03T10:00:00+09:00'),
        new Date('2026-05-12T10:00:00+09:00'),
      ],
      new Date('2026-05-12T12:00:00+09:00'),
    );

    assert.deepEqual(result, {
      completedDays: 3,
      elapsedDays: 12,
      monthTogetherDaysPercent: 25,
    });
  });

  void it('formats child age from birth date', () => {
    const today = new Date('2026-05-12T12:00:00+09:00');

    assert.equal(
      getAgeMonths(new Date('2023-04-20T00:00:00+09:00'), today),
      36,
    );
    assert.equal(
      getAgeLabel(new Date('2023-04-20T00:00:00+09:00'), today),
      '만3세',
    );
  });
});
