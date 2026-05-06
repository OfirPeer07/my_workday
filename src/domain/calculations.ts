import type {
  BalanceStatus,
  DaySummary,
  PeriodSummary,
  TimeEntry,
  UserSettings,
  WeekSummary,
} from "../types";
import {
  addDays,
  getRequiredHoursForDate,
  getWeekDates,
} from "./workSchedule";

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

function getStatus(balanceHours: number): BalanceStatus {
  if (balanceHours > 0) {
    return "extra";
  }
  if (balanceHours < 0) {
    return "missing";
  }
  return "exact";
}

export function buildPeriodSummary(
  actualHours: number,
  requiredHours: number,
): PeriodSummary {
  const balanceHours = roundHours(actualHours - requiredHours);
  return {
    actualHours: roundHours(actualHours),
    requiredHours: roundHours(requiredHours),
    balanceHours,
    extraHours: roundHours(Math.max(balanceHours, 0)),
    missingHours: roundHours(Math.max(-balanceHours, 0)),
    status: getStatus(balanceHours),
  };
}

export function calculateEntryHours(entry: TimeEntry): number {
  const [startHour, startMinute] = entry.startTime.split(":").map(Number);
  const [endHour, endMinute] = entry.endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const netMinutes = Math.max(endMinutes - startMinutes, 0);
  return roundHours(netMinutes / 60);
}

export function calculateDaySummary(
  date: string,
  entries: TimeEntry[],
  settings: UserSettings,
): DaySummary {
  const actualHours = entries
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + calculateEntryHours(entry), 0);
  const requiredHours = getRequiredHoursForDate(date, settings);

  return {
    date,
    ...buildPeriodSummary(actualHours, requiredHours),
  };
}

export function calculateWeekSummary(
  entries: TimeEntry[],
  settings: UserSettings,
  weekStart: string,
  today = new Date().toISOString().slice(0, 10),
): WeekSummary {
  const weekDates = getWeekDates(weekStart);
  const daySummaries = weekDates.map((date) =>
    calculateDaySummary(date, entries, settings),
  );
  const actualHours = daySummaries.reduce((sum, day) => sum + day.actualHours, 0);
  const requiredHours = daySummaries.reduce(
    (sum, day) => sum + day.requiredHours,
    0,
  );
  const requiredToDateHours = daySummaries
    .filter((day) => day.date <= today)
    .reduce((sum, day) => sum + day.requiredHours, 0);
  const actualToDateHours = daySummaries
    .filter((day) => day.date <= today)
    .reduce((sum, day) => sum + day.actualHours, 0);
  const base = buildPeriodSummary(actualHours, requiredHours);
  const balanceToDateHours = roundHours(actualToDateHours - requiredToDateHours);

  return {
    ...base,
    weekStart,
    weekEnd: addDays(weekStart, 6),
    completedPercentage:
      requiredHours === 0 ? 100 : Math.min(roundHours((actualHours / requiredHours) * 100), 100),
    actualToDateHours,
    requiredToDateHours,
    balanceToDateHours,
    toDateStatus: getStatus(balanceToDateHours),
  };
}

export function calculateMonthSummary(
  entries: TimeEntry[],
  settings: UserSettings,
  month: string,
  throughDate?: string,
): PeriodSummary {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  }).filter((date) => !throughDate || date <= throughDate);
  const actualHours = entries
    .filter(
      (entry) =>
        entry.date.startsWith(`${month}-`) &&
        (!throughDate || entry.date <= throughDate),
    )
    .reduce((sum, entry) => sum + calculateEntryHours(entry), 0);
  const requiredHours = dates.reduce(
    (sum, date) => sum + getRequiredHoursForDate(date, settings),
    0,
  );

  return buildPeriodSummary(actualHours, requiredHours);
}
