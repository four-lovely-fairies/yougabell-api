import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDurationLabel,
  getAgeMonths,
  getAgeLabel,
  getPreviousCompletedWeekStart,
  getWeekInfo,
  toDateOnly,
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

  void it('finds the previous completed week for weekly report summaries', () => {
    const result = getPreviousCompletedWeekStart(
      new Date('2026-05-15T12:00:00+09:00'),
    );

    assert.equal(toDateOnly(result), '2026-05-04');
  });

  void it('formats duration labels for home weekly report summaries', () => {
    assert.equal(formatDurationLabel(17 * 60), '17분');
    assert.equal(formatDurationLabel(60 * 60), '1시간');
    assert.equal(formatDurationLabel(77 * 60), '1시간 17분');
  });

  void it('formats child age from birth date', () => {
    const today = new Date('2026-05-12T12:00:00+09:00');

    assert.equal(
      getAgeMonths(new Date('2023-04-20T00:00:00+09:00'), today),
      36,
    );
    assert.equal(
      getAgeLabel(new Date('2023-04-20T00:00:00+09:00'), today),
      '36개월',
    );
    assert.equal(
      getAgeLabel(new Date('2025-05-12T00:00:00+09:00'), today),
      '12개월',
    );
  });
});
