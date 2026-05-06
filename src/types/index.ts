export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type UserSettings = {
  workDays: Weekday[];
  requiredHoursByDay: Record<Weekday, number>;
  weekStartsOn: Weekday;
};

export type TimeEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  source: "manual" | "calendar";
  note?: string;
};

export type BalanceStatus = "extra" | "missing" | "exact";

export type PeriodSummary = {
  requiredHours: number;
  actualHours: number;
  balanceHours: number;
  extraHours: number;
  missingHours: number;
  status: BalanceStatus;
};

export type DaySummary = PeriodSummary & {
  date: string;
};

export type WeekSummary = PeriodSummary & {
  weekStart: string;
  weekEnd: string;
  completedPercentage: number;
  actualToDateHours: number;
  requiredToDateHours: number;
  balanceToDateHours: number;
  toDateStatus: BalanceStatus;
};
