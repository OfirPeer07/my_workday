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
  Moon,
  Settings2,
  Sun,
  Timer,
  Trash2,
} from "lucide-react";
import "./styles.css";
import {
  calculateDaySummary,
  calculateEntryHours,
  calculateMonthSummary,
} from "./domain/calculations";
import { CrystalSmokeCanvas } from "./components/CrystalSmokeCanvas";
import {
  addDays,
  defaultSettings,
  getWeekdayFromDate,
  weekdayLabels,
  weekdays,
} from "./domain/workSchedule";
import {
  deleteCloudEntry,
  getCurrentSession,
  loadCloudEntries,
  loadCloudSettings,
  saveCloudEntry,
  saveCloudSettings,
  sendEmailSignInLink,
  signOutFromSupabase,
  subscribeToAuthState,
} from "./supabase/repository";
import { isSupabaseConfigured } from "./supabase/client";
import crystalBallSmokeUrl from "./assets/crystal_ball_purple_smoke.jpg";
import type { BalanceStatus, TimeEntry, UserSettings, Weekday } from "./types";
import type { User } from "@supabase/supabase-js";

type ThemeMode = "light" | "dark";

const authUnavailableMessage = "Email sign-in is not configured yet.";

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
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone: israelTimeZone,
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(now),
  };
}

type WeatherState =
  | { status: "loading" }
  | {
      status: "ready";
      temperature: number;
      humidity: number;
      windSpeed: number;
      description: string;
      locationName?: string;
    }
  | { status: "unsupported" | "denied" | "error"; message: string };

const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY?.trim() ?? "";
const israelFallbackWeatherCoords = {
  latitude: 32.0853,
  longitude: 34.7818,
  label: "Tel Aviv",
};

type WeatherCoords = {
  latitude: number;
  longitude: number;
  label?: string;
};

function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 95 && code <= 99) return "Storm";
  return "Weather";
}

function normalizeOpenWeatherDescription(value: string | undefined): string {
  if (!value) return "Weather";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function fetchOpenWeather(
  coords: WeatherCoords,
  signal: AbortSignal,
): Promise<Extract<WeatherState, { status: "ready" }>> {
  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    appid: weatherApiKey,
    units: "metric",
  });
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?${params}`,
    { signal },
  );

  if (!response.ok) throw new Error("OpenWeather request failed.");

  const data = (await response.json()) as {
    main?: {
      temp?: number;
      humidity?: number;
    };
    weather?: Array<{
      description?: string;
    }>;
    wind?: {
      speed?: number;
    };
  };

  if (data.main?.temp === undefined) {
    throw new Error("OpenWeather response is missing current data.");
  }

  return {
    status: "ready",
    temperature: data.main.temp,
    humidity: data.main.humidity ?? 0,
    windSpeed: Math.round((data.wind?.speed ?? 0) * 3.6),
    description: normalizeOpenWeatherDescription(data.weather?.[0]?.description),
    locationName: coords.label,
  };
}

async function fetchOpenMeteo(
  coords: WeatherCoords,
  signal: AbortSignal,
): Promise<Extract<WeatherState, { status: "ready" }>> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal,
  });

  if (!response.ok) throw new Error("Open-Meteo request failed.");

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };

  const current = data.current;
  if (!current || current.temperature_2m === undefined) {
    throw new Error("Open-Meteo response is missing current data.");
  }

  return {
    status: "ready",
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m ?? 0,
    windSpeed: current.wind_speed_10m ?? 0,
    description: describeWeatherCode(current.weather_code ?? -1),
    locationName: coords.label,
  };
}

async function resolveApproximateWeatherCoords(signal: AbortSignal): Promise<WeatherCoords> {
  try {
    const response = await fetch("https://ipapi.co/json/", { signal });
    if (!response.ok) throw new Error("IP location request failed.");

    const data = (await response.json()) as {
      latitude?: number;
      longitude?: number;
      city?: string;
      country_name?: string;
    };

    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
      throw new Error("IP location response is missing coordinates.");
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      label: data.city || data.country_name || "Approximate location",
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return israelFallbackWeatherCoords;
  }
}

async function loadWeatherForCoords(
  coords: WeatherCoords,
  signal: AbortSignal,
): Promise<Extract<WeatherState, { status: "ready" }>> {
  if (weatherApiKey) {
    try {
      return await fetchOpenWeather(coords, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn("OpenWeather failed, falling back to Open-Meteo.", error);
    }
  }

  return fetchOpenMeteo(coords, signal);
}

function useCurrentWeather(): WeatherState {
  const [weather, setWeather] = React.useState<WeatherState>({ status: "loading" });

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadFallbackWeather() {
      try {
        const coords = await resolveApproximateWeatherCoords(controller.signal);
        setWeather(await loadWeatherForCoords(coords, controller.signal));
      } catch (error) {
        if (controller.signal.aborted) return;
        setWeather({
          status: "error",
          message: "Weather data is not available right now.",
        });
      }
    }

    if (!navigator.geolocation) {
      void loadFallbackWeather();
      return () => controller.abort();
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setWeather(
            await loadWeatherForCoords(
              {
                latitude: coords.latitude,
                longitude: coords.longitude,
                label: "Current location",
              },
              controller.signal,
            ),
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          void loadFallbackWeather();
        }
      },
      () => {
        void loadFallbackWeather();
      },
      {
        enableHighAccuracy: false,
        maximumAge: 600_000,
        timeout: 10_000,
      },
    );

    return () => controller.abort();
  }, []);

  return weather;
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
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
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

function CloudAccountButton({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  return (
    <div className="google-auth-chip is-connected" title={user.email ?? "Signed in"}>
      <Cloud size={16} aria-hidden="true" />
      <span>{user.email ?? "Signed in"}</span>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <span>×</span>
      </button>
    </div>
  );
}

function EnglishLoginPage() {
  const clock = useIsraelClock();
  const weather = useCurrentWeather();
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);

  async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setSentMessage(null);

    if (!isSupabaseConfigured) {
      setAuthError(authUnavailableMessage);
      return;
    }

    setIsSending(true);

    try {
      await sendEmailSignInLink(email);
      setSentMessage("Check your email for the sign-in link.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Email sign-in failed.");
    } finally {
      setIsSending(false);
    }
  }

  const errorMessage = authError;

  return (
    <main className="login-shell login-shell-clean" dir="ltr">
      <div
        className="login-crystal-bg"
        style={{ backgroundImage: `url(${crystalBallSmokeUrl})` }}
        aria-hidden="true"
      />
      <CrystalSmokeCanvas />
      <div className="login-smoke-layer login-smoke-layer-one" aria-hidden="true" />
      <div className="login-smoke-layer login-smoke-layer-two" aria-hidden="true" />

      <section className="clean-login-card liquid-login-card" aria-label="Email sign in">
        <div className="clean-login-brand">
          <span>Workday Ledger</span>
          <h1>Work Hours Login</h1>
          <p>Sign in with email to store work records securely in Supabase.</p>
        </div>

        <div className="clean-login-stack" aria-label="Clock and weather">
          <div className="clean-login-clock" aria-label="Israel clock">
            <span>Clock · Israel Time</span>
            <strong>{clock.time}</strong>
            <small>{clock.date}</small>
          </div>

          <div className={`clean-weather-card is-${weather.status}`}>
            <span>Weather · Current Location</span>
            {weather.status === "ready" ? (
              <>
              <strong>{Math.round(weather.temperature)}°</strong>
              <small>
                {weather.locationName ? `${weather.locationName} · ` : ""}
                {weather.description} · Humidity {Math.round(weather.humidity)}% · Wind{" "}
                {Math.round(weather.windSpeed)} km/h
              </small>
              </>
            ) : (
              <>
                <strong>{weather.status === "loading" ? "Loading..." : "Unavailable"}</strong>
                <small>
                  {weather.status === "loading"
                    ? "Connecting to the weather API with browser location permission."
                    : weather.message}
                </small>
              </>
            )}
          </div>
        </div>

        <form
          className="clean-gmail-card"
          aria-label="Email authentication"
          onSubmit={handleEmailSignIn}
        >
          <label className="email-login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            type="submit"
            className="gmail-login-button"
            disabled={isSending}
          >
            <Cloud size={18} aria-hidden="true" />
            <span>{isSending ? "Sending link..." : "Send sign-in link"}</span>
          </button>

          {sentMessage ? <p className="login-success">{sentMessage}</p> : null}
          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
        </form>
      </section>
    </main>
  );
}

function Header({
  themeMode,
  onThemeChange,
  selectedMonth,
  maxMonth,
  onMonthChange,
  onExport,
  user,
  onSignOut,
}: {
  themeMode: ThemeMode;
  onThemeChange: (themeMode: ThemeMode) => void;
  selectedMonth: string;
  maxMonth: string;
  onMonthChange: (month: string) => void;
  onExport: () => void;
  user: User;
  onSignOut: () => void;
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
        <CloudAccountButton user={user} onSignOut={onSignOut} />

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
              <th>Day / Date</th>
              <th>Records</th>
              <th>Standard</th>
              <th>Actual</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
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

              if (isBlankDay) {
                return (
                  <tr key={date} className="is-blank-day is-compact-blank">
                    <td data-label="Day / Date" className="day-date-cell">
                      <strong>{weekdayLabels[weekday]}</strong>
                      <small>{formatDisplayDate(date)}</small>
                    </td>
                    <td data-label="Records" colSpan={7}>
                      <span className="blank-chip">Blank</span>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={date} className={date === activeDate ? "is-today" : ""}>
                  <td data-label="Day / Date" className="day-date-cell">
                    <strong>{weekdayLabels[weekday]}</strong>
                    <small>{formatDisplayDate(date)}</small>
                  </td>
                  <td data-label="Records">
                    {dayEntries.length > 0 ? (
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
                  <td data-label="Standard">{summary.requiredHours}</td>
                  <td data-label="Actual">{formatDuration(summary.actualHours)}</td>
                  <td data-label="Balance" className={toneForStatus(summary.status)}>
                    {formatTimeBalance(summary.balanceHours)}
                  </td>
                  <td data-label="Status">
                    <span className={`status-pill ${toneForStatus(summary.status)}`}>
                      {summary.status === "extra"
                        ? "Plus"
                        : summary.status === "missing"
                          ? "Minus"
                          : "Balanced"}
                    </span>
                  </td>
                  <td data-label="Start">
                    <input
                      className="table-time-input"
                      aria-label="שעת כניסה"
                      type="time"
                      value={draft.startTime}
                      onChange={(event) =>
                        updateDraft(date, "startTime", event.target.value)
                      }
                    />
                  </td>
                  <td data-label="End">
                    <input
                      className="table-time-input"
                      aria-label="שעת יציאה"
                      type="time"
                      value={draft.endTime}
                      onChange={(event) =>
                        updateDraft(date, "endTime", event.target.value)
                      }
                    />
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

function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    workDays: settings.workDays,
    requiredHoursByDay: settings.requiredHoursByDay,
    weekStartsOn: settings.weekStartsOn,
  };
}

function sortEntries(entries: TimeEntry[]): TimeEntry[] {
  return [...entries].sort((a, b) =>
    `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`),
  );
}

function App() {
  const { themeMode, setThemeMode } = useThemeMode();
  const activeWorkDate = useActiveWorkDate();
  const currentIsraelDate = getIsraelDate(new Date());
  const activeMonth = getMonthFromDate(activeWorkDate);
  const [user, setUser] = React.useState<User | null>(null);
  const [authLoading, setAuthLoading] = React.useState(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [appError, setAppError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<UserSettings>(() =>
    normalizeSettings(defaultSettings),
  );
  const [entries, setEntries] = React.useState<TimeEntry[]>([]);
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

  React.useEffect(() => {
    if (selectedMonth > activeMonth) {
      setSelectedMonth(activeMonth);
    }
  }, [activeMonth, selectedMonth]);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    getCurrentSession()
      .then((session) => setUser(session?.user ?? null))
      .catch(handleCloudError)
      .finally(() => setAuthLoading(false));

    return subscribeToAuthState((session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setSettings(normalizeSettings(defaultSettings));
        setEntries([]);
      }
    });
  }, []);

  React.useEffect(() => {
    if (!user) {
      return;
    }

    let isCurrent = true;
    setDataLoading(true);
    setAppError(null);

    Promise.all([loadCloudSettings(user), loadCloudEntries(user)])
      .then(([cloudSettings, cloudEntries]) => {
        if (!isCurrent) {
          return;
        }

        const normalizedSettings = normalizeSettings(cloudSettings ?? defaultSettings);
        setSettings(normalizedSettings);
        setEntries(sortEntries(cloudEntries));

        if (!cloudSettings) {
          return saveCloudSettings(user, normalizedSettings);
        }
      })
      .catch(handleCloudError)
      .finally(() => {
        if (isCurrent) {
          setDataLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [user]);

  function handleCloudError(error: unknown) {
    setAppError(error instanceof Error ? error.message : "Cloud operation failed.");
  }

  async function handleSignOut() {
    try {
      await signOutFromSupabase();
    } catch (error) {
      handleCloudError(error);
    }
  }

  async function updateSettings(settingsUpdate: UserSettings) {
    if (!user) {
      return;
    }

    const normalizedSettings = normalizeSettings(settingsUpdate);

    try {
      await saveCloudSettings(user, normalizedSettings);
      setSettings(normalizedSettings);
      setAppError(null);
    } catch (error) {
      handleCloudError(error);
    }
  }

  async function addEntry(entry: TimeEntry) {
    if (!user) {
      return;
    }

    try {
      await saveCloudEntry(user, entry);
      setEntries((current) => sortEntries([entry, ...current]));
      setSelectedMonth(getMonthFromDate(entry.date));
      setAppError(null);
    } catch (error) {
      handleCloudError(error);
    }
  }

  async function deleteEntry(id: string) {
    if (!user) {
      return;
    }

    try {
      await deleteCloudEntry(user, id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setAppError(null);
    } catch (error) {
      handleCloudError(error);
    }
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

  if (authLoading || !user) {
    return <EnglishLoginPage />;
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
          user={user}
          onSignOut={handleSignOut}
        />

        {dataLoading || appError ? (
          <div className={`sync-banner ${appError ? "is-error" : ""}`}>
            {appError ?? "Loading cloud data..."}
          </div>
        ) : null}

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
