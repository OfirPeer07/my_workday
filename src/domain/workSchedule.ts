import type { UserSettings, Weekday } from "../types";

export const weekdays: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const weekdayLabels: Record<Weekday, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};

export const defaultSettings: UserSettings = {
  workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
  requiredHoursByDay: {
    sunday: 9,
    monday: 9,
    tuesday: 9,
    wednesday: 9,
    thursday: 9,
    friday: 0,
    saturday: 0,
  },
  weekStartsOn: "sunday",
};

export function getWeekdayFromDate(date: string): Weekday {
  const dayIndex = new Date(`${date}T00:00:00`).getDay();
  return weekdays[dayIndex];
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getWeekStart(date: string, weekStartsOn: Weekday): string {
  const currentDay = getWeekdayFromDate(date);
  const currentIndex = weekdays.indexOf(currentDay);
  const startIndex = weekdays.indexOf(weekStartsOn);
  const diff = (currentIndex - startIndex + 7) % 7;
  return addDays(date, -diff);
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function getRequiredHoursForDate(
  date: string,
  settings: UserSettings,
): number {
  const weekday = getWeekdayFromDate(date);
  if (!settings.workDays.includes(weekday)) {
    return 0;
  }
  return settings.requiredHoursByDay[weekday] ?? 0;
}
