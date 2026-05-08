import "@fontsource/assistant/hebrew-400.css";
import "@fontsource/assistant/hebrew-500.css";
import "@fontsource/assistant/hebrew-600.css";
import "@fontsource/assistant/hebrew-700.css";
import "@fontsource/assistant/hebrew-800.css";
import React from "react";
import ReactDOM from "react-dom/client";
import {
  CalendarDays,
  Cloud,
  Download,
  LogOut,
  Moon,
  Settings2,
  Sun,
  Timer,
  Trash2,
  UploadCloud,
} from "lucide-react";
import "./styles.css";
import {
  calculateDaySummary,
  calculateEntryHours,
  calculateMonthSummary,
} from "./domain/calculations";
import {
  addDays,
  getWeekdayFromDate,
  weekdayLabels,
  weekdays,
} from "./domain/workSchedule";
import { loadSettings, saveSettings } from "./storage/settingsRepository";
import {
  loadTimeEntries,
  saveTimeEntries,
} from "./storage/timeEntriesRepository";
import type { BalanceStatus, TimeEntry, UserSettings, Weekday } from "./types";
import { isFirebaseConfigured } from "./firebase/config";
import {
  authenticateWithEmail,
  deleteCloudEntry,
  listenToAuthState,
  logoutFromFirebase,
  saveCloudEntry,
  saveCloudSettings,
  signInWithGoogle,
  subscribeToCloudEntries,
  subscribeToCloudSettings,
  uploadLocalDataToCloud,
  type AuthMode,
} from "./firebase/repository";
import type { User as FirebaseUser } from "firebase/auth";

type ThemeMode = "light" | "dark";

const israelTimeZone = "Asia/Jerusalem";
const monthLabels = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function getIsraelDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: israelTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getIsraelHour(date: Date): number {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: israelTimeZone,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? 0);
  return hour === 24 ? 0 : hour;
}

function getActiveWorkDate(now = new Date()): string {
  const israelDate = getIsraelDate(now);
  return getIsraelHour(now) < 8 ? addDays(israelDate, -1) : israelDate;
}

function getMonthFromDate(date: string): string {
  return date.slice(0, 7);
}

function getMonthEndDate(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function getMonthDates(month: string, throughDate: string): string[] {
  const endDate = throughDate.startsWith(`${month}-`)
    ? throughDate
    : getMonthEndDate(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const endDay = Number(endDate.slice(8, 10));

  return Array.from({ length: endDay }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(monthNumber).padStart(2, "0")}-${day}`;
  });
}

function getMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${monthLabels[monthNumber - 1]} ${year}`;
}

function buildMonth(year: number, monthNumber: number): string {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function getLaterDate(firstDate: string, secondDate: string): string {
  return firstDate >= secondDate ? firstDate : secondDate;
}

function getLatestEntryDateThrough(
  entries: TimeEntry[],
  throughCalendarDate: string,
  month?: string,
): string | null {
  return entries
    .filter(
      (entry) =>
        entry.date <= throughCalendarDate &&
        (!month || entry.date.startsWith(`${month}-`)),
    )
    .reduce<string | null>(
      (latestDate, entry) =>
        latestDate === null || entry.date > latestDate ? entry.date : latestDate,
      null,
    );
}

function formatTimeBalance(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const sign = totalMinutes > 0 ? "+" : totalMinutes < 0 ? "-" : "";
  const absoluteMinutes = Math.abs(totalMinutes);
  const displayHours = Math.floor(absoluteMinutes / 60);
  const displayMinutes = absoluteMinutes % 60;
  return `${sign}${String(displayHours).padStart(2, "0")}:${String(displayMinutes).padStart(2, "0")}`;
}

function formatDuration(hours: number): string {
  const totalMinutes = Math.max(Math.round(hours * 60), 0);
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = totalMinutes % 60;
  return `${String(displayHours).padStart(2, "0")}:${String(displayMinutes).padStart(2, "0")}`;
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function balanceCopy(status: BalanceStatus, hours: number): string {
  const absoluteHours = Number(Math.abs(hours).toFixed(2));
  if (status === "extra") return `עודף של ${absoluteHours} שעות`;
  if (status === "missing") return `חוסר של ${absoluteHours} שעות`;
  return "בדיוק על היעד";
}

function balanceDisplayCopy(status: BalanceStatus, hours: number): string {
  const amount = formatDuration(Math.abs(hours));
  if (status === "extra") return `עודף של ${amount}`;
  if (status === "missing") return `חוסר של ${amount}`;
  return "בדיוק על היעד";
}

function toneForStatus(status: BalanceStatus): string {
  if (status === "extra") return "is-positive";
  if (status === "missing") return "is-negative";
  return "is-neutral";
}

function useIsraelClock() {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  return {
    time: new Intl.DateTimeFormat("he-IL", {
      timeZone: israelTimeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(now),
    date: new Intl.DateTimeFormat("he-IL", {
      timeZone: israelTimeZone,
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(now),
  };
}

function useActiveWorkDate() {
  const [activeWorkDate, setActiveWorkDate] = React.useState(() =>
    getActiveWorkDate(),
  );

  React.useEffect(() => {
    const timerId = window.setInterval(
      () => setActiveWorkDate(getActiveWorkDate()),
      60_000,
    );
    return () => window.clearInterval(timerId);
  }, []);

  return activeWorkDate;
}

function useThemeMode() {
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem("my-workday:theme");
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem("my-workday:theme", themeMode);
  }, [themeMode]);

  return { themeMode, setThemeMode };
}

function ThemeToggle({
  themeMode,
  onChange,
}: {
  themeMode: ThemeMode;
  onChange: (themeMode: ThemeMode) => void;
}) {
  const isDark = themeMode === "dark";
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      className="theme-switch"
      onClick={() => onChange(isDark ? "light" : "dark")}
      aria-label={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}

function GoogleAuthButton({
  firebaseReady,
  user,
  authLoading,
  syncStatus,
  syncError,
}: {
  firebaseReady: boolean;
  user: FirebaseUser | null;
  authLoading: boolean;
  syncStatus: string;
  syncError: string | null;
}) {
  const [isBusy, setIsBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  async function handleSignIn() {
    setIsBusy(true);
    setAuthError(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    setIsBusy(true);
    setAuthError(null);

    try {
      await logoutFromFirebase();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!firebaseReady) {
    return (
      <div className="google-auth-chip is-disabled" title="Firebase is not configured">
        <Cloud size={16} aria-hidden="true" />
        <span>Local</span>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="google-auth-chip is-disabled">
        <Cloud size={16} aria-hidden="true" />
        <span>בודק...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div
        className="google-auth-chip is-connected"
        title={syncError ?? syncStatus}
      >
        <Cloud size={16} aria-hidden="true" />
        <span>{user.displayName ?? user.email ?? "Google"}</span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isBusy}
          aria-label="התנתקות"
          title="התנתקות"
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="google-auth-chip"
      onClick={handleSignIn}
      disabled={isBusy}
      title={authError ?? syncStatus}
    >
      <Cloud size={16} aria-hidden="true" />
      <span>כניסה עם Google</span>
    </button>
  );
}

function Header({
  themeMode,
  onThemeChange,
  selectedMonth,
  maxMonth,
  onMonthChange,
  onExport,
  firebaseReady,
  firebaseUser,
  authLoading,
  syncStatus,
  syncError,
}: {
  themeMode: ThemeMode;
  onThemeChange: (themeMode: ThemeMode) => void;
  selectedMonth: string;
  maxMonth: string;
  onMonthChange: (month: string) => void;
  onExport: () => void;
  firebaseReady: boolean;
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  syncStatus: string;
  syncError: string | null;
}) {
  const clock = useIsraelClock();
  const selectedYear = Number(selectedMonth.slice(0, 4));
  const selectedMonthNumber = Number(selectedMonth.slice(5, 7));
  const activeYear = Number(maxMonth.slice(0, 4));
  const yearOptions = [activeYear - 1, activeYear, activeYear + 1];

  function changeYear(year: number) {
    const nextMonth = buildMonth(year, selectedMonthNumber);
    onMonthChange(nextMonth > maxMonth ? maxMonth : nextMonth);
  }

  function changeMonth(monthNumber: number) {
    const nextMonth = buildMonth(selectedYear, monthNumber);
    onMonthChange(nextMonth > maxMonth ? maxMonth : nextMonth);
  }

  return (
    <header className="app-header">
      <div>
        <div className="eyebrow">Workday Ledger</div>
        <h1>מעקב שעות מול תקן</h1>
      </div>

      <div className="header-actions">
        <GoogleAuthButton
          firebaseReady={firebaseReady}
          user={firebaseUser}
          authLoading={authLoading}
          syncStatus={syncStatus}
          syncError={syncError}
        />

        <div className="clock-chip" title="Asia/Jerusalem">
          <Timer size={17} aria-hidden="true" />
          <div>
            <strong>{clock.time}</strong>
            <span>{clock.date}</span>
          </div>
        </div>

        <ThemeToggle themeMode={themeMode} onChange={onThemeChange} />

        <label className="date-chip">
          <CalendarDays size={17} aria-hidden="true" />
          <select
            aria-label="בחירת חודש"
            value={selectedMonthNumber}
            onChange={(event) => changeMonth(Number(event.target.value))}
          >
            {monthLabels.map((label, index) => {
              const monthNumber = index + 1;
              const optionMonth = buildMonth(selectedYear, monthNumber);
              return (
                <option
                  key={label}
                  value={monthNumber}
                  disabled={optionMonth > maxMonth}
                >
                  {label}
                </option>
              );
            })}
          </select>
          <select
            aria-label="בחירת שנה"
            value={selectedYear}
            onChange={(event) => changeYear(Number(event.target.value))}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="primary-action" onClick={onExport}>
          <Download size={17} aria-hidden="true" />
          CSV
        </button>
      </div>
    </header>
  );
}

function BalanceHero({
  balanceHours,
  status,
  requiredToDateHours,
  actualHours,
  completedPercentage,
}: {
  balanceHours: number;
  status: BalanceStatus;
  requiredToDateHours: number;
  actualHours: number;
  completedPercentage: number;
}) {
  return (
    <section className={`balance-hero ${toneForStatus(status)}`}>
      <div>
        <div className="balance-title-row">
          <span>יתרה חודשית</span>
          <small>פורמט זמן</small>
        </div>
        <strong>{formatTimeBalance(balanceHours)}</strong>
        <p>{balanceDisplayCopy(status, balanceHours)}</p>
      </div>
      <dl>
        <div>
          <dt>בוצע</dt>
          <dd>{formatDuration(actualHours)}</dd>
        </div>
        <div>
          <dt>תקן עד היום</dt>
          <dd>{formatDuration(requiredToDateHours)}</dd>
        </div>
      </dl>
      <div className="hero-progress" aria-label="התקדמות שבועית">
        <span style={{ width: `${completedPercentage}%` }} />
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  status = "exact",
}: {
  label: string;
  value: string;
  status?: BalanceStatus;
}) {
  return (
    <div className={`metric-tile ${toneForStatus(status)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MonthLedgerTable({
  entries,
  settings,
  activeDate,
  selectedMonth,
  displayThroughDate,
  onAddEntry,
  onDeleteEntry,
}: {
  entries: TimeEntry[];
  settings: UserSettings;
  activeDate: string;
  selectedMonth: string;
  displayThroughDate: string;
  onAddEntry: (entry: TimeEntry) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const dates = getMonthDates(selectedMonth, displayThroughDate);
  const visibleMonthEnd = dates.length > 0 ? dates[dates.length - 1] : `${selectedMonth}-01`;
  const [drafts, setDrafts] = React.useState<Record<string, { startTime: string; endTime: string }>>(
    {},
  );
  const pendingDrafts = Object.entries(drafts).filter(
    ([, draft]) => draft.startTime && draft.endTime,
  );

  function updateDraft(
    date: string,
    field: "startTime" | "endTime",
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [date]: {
        startTime: current[date]?.startTime ?? "09:00",
        endTime: current[date]?.endTime ?? "18:00",
        [field]: value,
      },
    }));
  }

  function saveDrafts() {
    pendingDrafts.forEach(([date, draft]) => {
      onAddEntry({
        id: crypto.randomUUID(),
        date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        source: "manual",
      });
    });
    setDrafts({});
  }

  return (
    <section className="ledger-panel">
      <div className="section-title">
        <div>
          <span>Monthly Ledger</span>
          <h2>טבלת חודש</h2>
        </div>
        <strong>
          {getMonthLabel(selectedMonth)} · עד {formatDisplayDate(visibleMonthEnd)}
        </strong>
      </div>
      <div className="ledger-toolbar">
        <span>
          {pendingDrafts.length > 0
            ? `${pendingDrafts.length} רשומות ממתינות לשמירה`
            : "אין שינויים ממתינים"}
        </span>
        <button
          type="button"
          className="table-save-button"
          onClick={saveDrafts}
          disabled={pendingDrafts.length === 0}
        >
          שמירת שינויים
        </button>
      </div>

      <div className="table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>יום</th>
              <th>תאריך</th>
              <th>רשומות</th>
              <th>תקן</th>
              <th>בפועל</th>
              <th>יתרה</th>
              <th>סטטוס</th>
              <th>כניסה</th>
              <th>יציאה</th>
              <th>טיוטה</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const summary = calculateDaySummary(date, entries, settings);
              const weekday = getWeekdayFromDate(date);
              const dayEntries = entries
                .filter((entry) => entry.date === date)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isBlankDay =
                !settings.workDays.includes(weekday) && dayEntries.length === 0;
              const draft = drafts[date] ?? { startTime: "09:00", endTime: "18:00" };
              const draftHours = calculateEntryHours({
                id: "draft-preview",
                date,
                startTime: draft.startTime,
                endTime: draft.endTime,
                source: "manual",
              });

              return (
                <tr
                  key={date}
                  className={[
                    date === activeDate ? "is-today" : "",
                    isBlankDay ? "is-blank-day" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td>
                    <strong>{weekdayLabels[weekday]}</strong>
                  </td>
                  <td>{formatDisplayDate(date)}</td>
                  <td>
                    {isBlankDay ? (
                      <span className="blank-chip">Blank</span>
                    ) : dayEntries.length > 0 ? (
                      <div className="entry-stack">
                        {dayEntries.map((entry) => (
                          <span className="entry-chip" key={entry.id}>
                            <span>
                              {entry.startTime}-{entry.endTime}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteEntry(entry.id)}
                              aria-label="מחיקת רשומה"
                              title="מחיקת רשומה"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">אין</span>
                    )}
                  </td>
                  <td>{isBlankDay ? "" : summary.requiredHours}</td>
                  <td>{isBlankDay ? "" : formatDuration(summary.actualHours)}</td>
                  <td className={isBlankDay ? "muted" : toneForStatus(summary.status)}>
                    {isBlankDay ? "" : formatTimeBalance(summary.balanceHours)}
                  </td>
                  <td>
                    {isBlankDay ? (
                      <span className="status-pill is-blank">ללא תקן</span>
                    ) : (
                      <span className={`status-pill ${toneForStatus(summary.status)}`}>
                        {summary.status === "extra"
                          ? "פלוס"
                          : summary.status === "missing"
                            ? "מינוס"
                            : "מאוזן"}
                      </span>
                    )}
                  </td>
                  <td>
                    {isBlankDay ? (
                      <span className="muted">Blank</span>
                    ) : (
                      <input
                        className="table-time-input"
                        aria-label="שעת כניסה"
                        type="time"
                        value={draft.startTime}
                        onChange={(event) =>
                          updateDraft(date, "startTime", event.target.value)
                        }
                      />
                    )}
                  </td>
                  <td>
                    {isBlankDay ? (
                      <span className="muted">Blank</span>
                    ) : (
                      <input
                        className="table-time-input"
                        aria-label="שעת יציאה"
                        type="time"
                        value={draft.endTime}
                        onChange={(event) =>
                          updateDraft(date, "endTime", event.target.value)
                        }
                      />
                    )}
                  </td>
                  <td>
                    {isBlankDay ? (
                      <span className="muted">Blank</span>
                    ) : drafts[date] ? (
                      <span className="draft-pill">{formatDuration(draftHours)}</span>
                    ) : (
                      <span className="muted">לא נערך</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
}) {
  function toggleWorkday(day: Weekday) {
    const workDays = settings.workDays.includes(day)
      ? settings.workDays.filter((workday) => workday !== day)
      : [...settings.workDays, day];
    onChange({ ...settings, workDays });
  }

  function updateHours(day: Weekday, requiredHours: number) {
    onChange({
      ...settings,
      requiredHoursByDay: {
        ...settings.requiredHoursByDay,
        [day]: requiredHours,
      },
    });
  }

  return (
    <section className="side-panel">
      <div className="panel-heading">
        <Settings2 size={18} aria-hidden="true" />
        <h2>תקן עבודה</h2>
      </div>

      <div className="settings-list">
        {weekdays.map((day) => (
          <div className="settings-row" key={day}>
            <label>
              <input
                type="checkbox"
                checked={settings.workDays.includes(day)}
                onChange={() => toggleWorkday(day)}
              />
              <span>{weekdayLabels[day]}</span>
            </label>
            <input
              min="0"
              step="0.25"
              type="number"
              value={settings.requiredHoursByDay[day]}
              onChange={(event) => updateHours(day, Number(event.target.value))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function EntryList({
  entries,
  onDelete,
}: {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
}) {
  const sortedEntries = [...entries].sort((a, b) =>
    `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`),
  );

  return (
    <section className="side-panel">
      <div className="panel-heading">
        <Timer size={18} aria-hidden="true" />
        <h2>רשומות אחרונות</h2>
      </div>

      <div className="recent-list">
        {sortedEntries.slice(0, 5).map((entry) => (
          <div className="recent-row" key={entry.id}>
            <div>
              <strong>
                {formatDisplayDate(entry.date)} · {entry.startTime}-{entry.endTime}
              </strong>
              <span>
                {calculateEntryHours(entry)} שעות{entry.note ? ` · ${entry.note}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              aria-label="מחיקת רשומה"
              title="מחיקת רשומה"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}

        {sortedEntries.length === 0 ? (
          <div className="empty-state">עדיין אין רשומות שעות.</div>
        ) : null}
      </div>
    </section>
  );
}

function CloudSyncPanel({
  firebaseReady,
  user,
  authLoading,
  syncStatus,
  syncError,
  onUploadLocal,
}: {
  firebaseReady: boolean;
  user: FirebaseUser | null;
  authLoading: boolean;
  syncStatus: string;
  syncError: string | null;
  onUploadLocal: () => Promise<void>;
}) {
  const [mode, setMode] = React.useState<AuthMode>("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setAuthError(null);

    try {
      await authenticateWithEmail(mode, email.trim(), password);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadLocal() {
    setIsBusy(true);
    setAuthError(null);

    try {
      await onUploadLocal();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!firebaseReady) {
    return (
      <section className="side-panel cloud-panel">
        <div className="panel-heading">
          <Cloud size={18} aria-hidden="true" />
          <h2>Cloud Sync</h2>
        </div>
        <p className="sync-copy">
          Add Firebase values to `.env.local` to enable sync between desktop and
          phone.
        </p>
      </section>
    );
  }

  if (authLoading) {
    return (
      <section className="side-panel cloud-panel">
        <div className="panel-heading">
          <Cloud size={18} aria-hidden="true" />
          <h2>Cloud Sync</h2>
        </div>
        <p className="sync-copy">Checking Firebase session...</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="side-panel cloud-panel">
        <div className="panel-heading">
          <Cloud size={18} aria-hidden="true" />
          <h2>Cloud Sync</h2>
        </div>

        <div className="sync-account">
          <span>Signed in</span>
          <strong>{user.email}</strong>
        </div>

        <p className="sync-copy">{syncStatus}</p>
        {syncError ? <p className="sync-error">{syncError}</p> : null}

        <div className="sync-actions">
          <button type="button" onClick={uploadLocal} disabled={isBusy}>
            <UploadCloud size={16} aria-hidden="true" />
            Upload local data
          </button>
          <button type="button" onClick={logoutFromFirebase} disabled={isBusy}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="side-panel cloud-panel">
      <div className="panel-heading">
        <Cloud size={18} aria-hidden="true" />
        <h2>Cloud Sync</h2>
      </div>

      <form className="auth-form" onSubmit={submitAuth}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {authError ? <p className="sync-error">{authError}</p> : null}

        <button type="submit" className="primary-action wide" disabled={isBusy}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        className="link-button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in"
          ? "Create a new account"
          : "I already have an account"}
      </button>
    </section>
  );
}

function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    workDays: settings.workDays,
    requiredHoursByDay: settings.requiredHoursByDay,
    weekStartsOn: settings.weekStartsOn,
  };
}

function App() {
  const { themeMode, setThemeMode } = useThemeMode();
  const activeWorkDate = useActiveWorkDate();
  const currentIsraelDate = getIsraelDate(new Date());
  const activeMonth = getMonthFromDate(activeWorkDate);
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = React.useState(isFirebaseConfigured);
  const [syncStatus, setSyncStatus] = React.useState("Local only");
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<UserSettings>(() =>
    normalizeSettings(loadSettings()),
  );
  const [entries, setEntries] = React.useState<TimeEntry[]>(() =>
    loadTimeEntries(),
  );
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    getMonthFromDate(getActiveWorkDate()),
  );
  const latestEntryDate = getLatestEntryDateThrough(
    entries,
    currentIsraelDate,
    selectedMonth,
  );
  const selectedMonthEndDate =
    selectedMonth === activeMonth ? activeWorkDate : getMonthEndDate(selectedMonth);
  const summaryThroughDate = latestEntryDate
    ? getLaterDate(selectedMonthEndDate, latestEntryDate)
    : selectedMonthEndDate;
  const monthSummary = calculateMonthSummary(
    entries,
    settings,
    selectedMonth,
    summaryThroughDate,
  );
  const completedPercentage =
    monthSummary.requiredHours === 0
      ? 100
      : Math.min(
          Math.round((monthSummary.actualHours / monthSummary.requiredHours) * 100),
          100,
        );

  React.useEffect(() => saveSettings(settings), [settings]);
  React.useEffect(() => saveTimeEntries(entries), [entries]);
  React.useEffect(() => {
    if (selectedMonth > activeMonth) {
      setSelectedMonth(activeMonth);
    }
  }, [activeMonth, selectedMonth]);

  React.useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }

    return listenToAuthState((user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      setSyncStatus(user ? "Connected to Firebase." : "Local only.");
      setSyncError(null);
    });
  }, []);

  React.useEffect(() => {
    if (!firebaseUser) {
      return;
    }

    setSyncStatus("Syncing cloud data...");
    let receivedFirstEntriesSnapshot = false;

    const unsubscribeSettings = subscribeToCloudSettings(
      firebaseUser.uid,
      (cloudSettings) => {
        if (cloudSettings) {
          const normalizedSettings = normalizeSettings(cloudSettings);
          setSettings(normalizedSettings);
          saveSettings(normalizedSettings);
        }
        setSyncStatus("Cloud sync is active.");
      },
      (error) => {
        setSyncError(error.message);
        setSyncStatus("Cloud sync failed.");
      },
    );

    const unsubscribeEntries = subscribeToCloudEntries(
      firebaseUser.uid,
      (cloudEntries) => {
        if (!receivedFirstEntriesSnapshot) {
          receivedFirstEntriesSnapshot = true;
          const localEntries = loadTimeEntries();

          if (cloudEntries.length === 0 && localEntries.length > 0) {
            setSyncStatus("Cloud is empty. Upload local data to start sync.");
            return;
          }
        }

        setEntries(cloudEntries);
        saveTimeEntries(cloudEntries);
        setSyncStatus("Cloud sync is active.");
      },
      (error) => {
        setSyncError(error.message);
        setSyncStatus("Cloud sync failed.");
      },
    );

    return () => {
      unsubscribeSettings();
      unsubscribeEntries();
    };
  }, [firebaseUser]);

  function handleCloudError(error: unknown) {
    setSyncError(error instanceof Error ? error.message : "Cloud sync failed.");
    setSyncStatus("Saved locally. Cloud sync failed.");
  }

  function updateSettings(settingsUpdate: UserSettings) {
    const normalizedSettings = normalizeSettings(settingsUpdate);
    setSettings(normalizedSettings);

    if (firebaseUser) {
      setSyncStatus("Saving settings to cloud...");
      saveCloudSettings(firebaseUser.uid, normalizedSettings)
        .then(() => setSyncStatus("Cloud sync is active."))
        .catch(handleCloudError);
    }
  }

  function addEntry(entry: TimeEntry) {
    setEntries((current) => [entry, ...current]);
    setSelectedMonth(getMonthFromDate(entry.date));

    if (firebaseUser) {
      setSyncStatus("Saving entry to cloud...");
      saveCloudEntry(firebaseUser.uid, entry)
        .then(() => setSyncStatus("Cloud sync is active."))
        .catch(handleCloudError);
    }
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));

    if (firebaseUser) {
      setSyncStatus("Deleting entry from cloud...");
      deleteCloudEntry(firebaseUser.uid, id)
        .then(() => setSyncStatus("Cloud sync is active."))
        .catch(handleCloudError);
    }
  }

  async function uploadCurrentLocalData() {
    if (!firebaseUser) {
      return;
    }

    setSyncStatus("Uploading local data to Firebase...");
    setSyncError(null);
    await uploadLocalDataToCloud(firebaseUser.uid, settings, entries);
    setSyncStatus("Local data uploaded to Firebase.");
  }

  function exportCsv() {
    const header = "date,startTime,endTime,netHours,note";
    const rows = entries.map((entry) =>
      [
        entry.date,
        entry.startTime,
        entry.endTime,
        calculateEntryHours(entry),
        entry.note ?? "",
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "work-hours.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <Header
          themeMode={themeMode}
          onThemeChange={setThemeMode}
          selectedMonth={selectedMonth}
          maxMonth={activeMonth}
          onMonthChange={setSelectedMonth}
          onExport={exportCsv}
          firebaseReady={isFirebaseConfigured}
          firebaseUser={firebaseUser}
          authLoading={authLoading}
          syncStatus={syncStatus}
          syncError={syncError}
        />

        <section className="kpi-strip">
          <BalanceHero
            balanceHours={monthSummary.balanceHours}
            status={monthSummary.status}
            requiredToDateHours={monthSummary.requiredHours}
            actualHours={monthSummary.actualHours}
            completedPercentage={completedPercentage}
          />
          <MetricTile
            label="יעד חודשי"
            value={formatDuration(monthSummary.requiredHours)}
          />
          <MetricTile
            label="בוצע החודש"
            value={formatDuration(monthSummary.actualHours)}
          />
          <MetricTile
            label="יתרה חודשית"
            value={formatTimeBalance(monthSummary.balanceHours)}
            status={monthSummary.status}
          />
        </section>

        <div className="workspace-grid">
          <MonthLedgerTable
            entries={entries}
            settings={settings}
            activeDate={activeWorkDate}
            selectedMonth={selectedMonth}
            displayThroughDate={summaryThroughDate}
            onAddEntry={addEntry}
            onDeleteEntry={deleteEntry}
          />

          <aside className="side-stack">
            <SettingsPanel settings={settings} onChange={updateSettings} />
            <EntryList entries={entries} onDelete={deleteEntry} />
          </aside>
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
