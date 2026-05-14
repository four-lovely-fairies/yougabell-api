export type WeekdayLabel = '월' | '화' | '수' | '목' | '금' | '토' | '일';

export type HomeWeekDay = {
  date: string;
  weekdayLabel: WeekdayLabel;
  dayOfMonth: number;
  isToday: boolean;
};

export type HomeWeekInfo = {
  monthLabel: string;
  weekOfMonthLabel: string;
  days: HomeWeekDay[];
};

const WEEKDAY_LABELS: WeekdayLabel[] = [
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
  '일',
];
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getWeekInfo(today: Date): HomeWeekInfo {
  const local = toSeoulDateParts(today);
  const todayDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const dayOfWeek = todayDate.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = addUtcDays(todayDate, -daysFromMonday);
  const weekOfMonth = getIsoStyleWeekOfMonth(monday);

  const days = WEEKDAY_LABELS.map((weekdayLabel, index) => {
    const date = addUtcDays(monday, index);
    const isoDate = toDateOnly(date);
    return {
      date: isoDate,
      weekdayLabel,
      dayOfMonth: date.getUTCDate(),
      isToday: isoDate === toDateOnly(todayDate),
    };
  });

  return {
    monthLabel: `${weekOfMonth.month}월`,
    weekOfMonthLabel: `${weekOfMonth.week}주차`,
    days,
  };
}

export function getPreviousCompletedWeekStart(today: Date): Date {
  const local = toSeoulDateParts(today);
  const currentDate = new Date(
    Date.UTC(local.year, local.month - 1, local.day),
  );
  const dayOfWeek = currentDate.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentDate.setUTCDate(currentDate.getUTCDate() - daysFromMonday - 7);
  return currentDate;
}

export function formatDurationLabel(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }
  if (minutes === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${minutes}분`;
}

export function getAgeMonths(birthDate: Date, today: Date): number {
  const birth = toSeoulDateParts(birthDate);
  const current = toSeoulDateParts(today);
  const rawMonths =
    (current.year - birth.year) * 12 + (current.month - birth.month);
  return current.day < birth.day ? rawMonths - 1 : rawMonths;
}

export function getAgeLabel(birthDate: Date, today: Date): string {
  const ageYears = Math.floor(getAgeMonths(birthDate, today) / 12);
  return `만${ageYears}세`;
}

export function toDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function toSeoulDateParts(date: Date) {
  const seoulDate = new Date(date.getTime() + SEOUL_OFFSET_MS);
  return {
    year: seoulDate.getUTCFullYear(),
    month: seoulDate.getUTCMonth() + 1,
    day: seoulDate.getUTCDate(),
  };
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getIsoStyleWeekOfMonth(weekStartMonday: Date): {
  month: number;
  week: number;
} {
  const weekThursday = addUtcDays(weekStartMonday, 3);
  const firstWeekStart = getFirstThursdayWeekStart(
    weekThursday.getUTCFullYear(),
    weekThursday.getUTCMonth(),
  );
  const week =
    Math.floor(
      (weekStartMonday.getTime() - firstWeekStart.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ) + 1;

  return {
    month: weekThursday.getUTCMonth() + 1,
    week,
  };
}

function getFirstThursdayWeekStart(year: number, monthIndex: number): Date {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstDayOfWeek = firstDay.getUTCDay();
  const daysUntilThursday = (4 - firstDayOfWeek + 7) % 7;
  const firstThursday = addUtcDays(firstDay, daysUntilThursday);
  const firstThursdayDayOfWeek = firstThursday.getUTCDay();
  const daysFromMonday =
    firstThursdayDayOfWeek === 0 ? 6 : firstThursdayDayOfWeek - 1;

  return addUtcDays(firstThursday, -daysFromMonday);
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
