import { Weekday } from '../weekly-reports.types';

export const WEEKDAYS: Weekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export function getWeekday(date: Date): Weekday {
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = seoul.getUTCDay();
  return WEEKDAYS[day === 0 ? 6 : day - 1];
}

export function getPreviousCompletedWeekStart(today: Date): string {
  const seoul = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const currentSeoulDate = new Date(
    Date.UTC(seoul.getUTCFullYear(), seoul.getUTCMonth(), seoul.getUTCDate()),
  );
  const dayOfWeek = currentSeoulDate.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentSeoulDate.setUTCDate(
    currentSeoulDate.getUTCDate() - daysFromMonday - 7,
  );
  return toUtcDateOnly(currentSeoulDate);
}

export function parseDateOnly(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toSeoulDateKey(date: Date): string {
  return toUtcDateOnly(new Date(date.getTime() + 9 * 60 * 60 * 1000));
}

export function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
