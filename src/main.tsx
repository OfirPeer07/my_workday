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
  getWeekdayFromDate,
  weekdayLabels,
  weekdays,
} from "./domain/workSchedule";
import { loadSettings, saveSettings } from "./storage/settingsRepository";
import {
  loadTimeEntries,
  saveTimeEntries,
} from "./storage/timeEntriesRepository";
import crystalBallSmokeUrl from "./assets/crystal_ball_purple_smoke.jpg";
import type { BalanceStatus, TimeEntry, UserSettings, Weekday } from "./types";
import { isFirebaseConfigured } from "./firebase/config";
import {
  deleteCloudEntry,
  listenToAuthState,
  logoutFromFirebase,
  saveCloudEntry,
  saveCloudSettings,
  signInWithGoogle,
  subscribeToCloudEntries,
  subscribeToCloudSettings,
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

function LoginPage({
  firebaseReady,
  authLoading,
  syncError,
}: {
  firebaseReady: boolean;
  authLoading: boolean;
  syncError: string | null;
}) {
  const clock = useIsraelClock();
  const [isBusy, setIsBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  async function handleGoogleSignIn() {
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

  const errorMessage = authError ?? syncError;

  return (
    <main className="login-shell">
      <div
        className="login-crystal-bg"
        style={{ backgroundImage: `url(${crystalBallSmokeUrl})` }}
        aria-hidden="true"
      />
      <CrystalSmokeCanvas />
      <div className="login-smoke-layer login-smoke-layer-one" aria-hidden="true" />
      <div className="login-smoke-layer login-smoke-layer-two" aria-hidden="true" />
      <div className="login-grid" aria-hidden="true" />
      <div className="login-sweep" aria-hidden="true" />
      <div className="login-stage">
        <section className="login-visual" aria-label="תצוגת מערכת שעות">
          <div className="time-system-card">
            <div className="system-card-top">
              <span>Live Time System</span>
              <strong>Asia/Jerusalem</strong>
            </div>
            <div className="clock-dial">
              <span className="clock-hand clock-hand-hour" />
              <span className="clock-hand clock-hand-minute" />
              <span className="clock-hand clock-hand-second" />
              <span className="clock-core" />
            </div>
            <div className="digital-time">
              <strong>{clock.time}</strong>
              <span>{clock.date}</span>
            </div>
          </div>

          <div className="ledger-preview-card">
            <div className="preview-header">
              <span>Monthly Ledger</span>
              <strong>רשומות עבודה</strong>
            </div>
            {[
              ["09:00", "18:00", "+00:00", "מאוזן"],
              ["08:42", "18:04", "+00:22", "פלוס"],
              ["09:18", "17:44", "-00:34", "מינוס"],
            ].map(([start, end, balance, status]) => (
              <div className="preview-row" key={`${start}-${end}`}>
                <span>{start}</span>
                <span>{end}</span>
                <strong>{balance}</strong>
                <em>{status}</em>
              </div>
            ))}
          </div>

          <div className="sync-preview-card">
            <span>Sync Engine</span>
            <strong>Gmail {"->"} Firebase {"->"} Devices</strong>
            <div className="sync-line">
              <i />
            </div>
          </div>
        </section>

        <section className="login-card">
          <div className="login-brand">
            <span>Workday Ledger</span>
            <h1>מעקב שעות מול תקן</h1>
            <p>התחברות עם Gmail בלבד כדי לסנכרן רשומות, שעות ויתרות בין מחשב לסמארטפון.</p>
          </div>

          <div className="login-stats">
            <div>
              <span>תקן יומי</span>
              <strong>09:00</strong>
            </div>
            <div>
              <span>פורמט יתרה</span>
              <strong>+/- HH:mm</strong>
            </div>
          </div>

          <button
            type="button"
            className="gmail-login-button"
            onClick={handleGoogleSignIn}
            disabled={!firebaseReady || authLoading || isBusy}
          >
            <Cloud size={18} aria-hidden="true" />
            <span>
              {authLoading
                ? "בודק חיבור..."
                : firebaseReady
                  ? "כניסה עם Gmail"
                  : "Firebase לא מוגדר"}
            </span>
          </button>

          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}

function CompactLoginPage({
  firebaseReady,
  authLoading,
  syncError,
}: {
  firebaseReady: boolean;
  authLoading: boolean;
  syncError: string | null;
}) {
  const clock = useIsraelClock();
  const weather = useCurrentWeather();
  const [isBusy, setIsBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  async function handleGoogleSignIn() {
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

  const errorMessage = authError ?? syncError;

  return (
    <main className="login-shell login-shell-clean">
      <div
        className="login-crystal-bg"
        style={{ backgroundImage: `url(${crystalBallSmokeUrl})` }}
        aria-hidden="true"
      />
      <CrystalSmokeCanvas />
      <div className="login-smoke-layer login-smoke-layer-one" aria-hidden="true" />
      <div className="login-smoke-layer login-smoke-layer-two" aria-hidden="true" />

      <section className="clean-login-card" aria-label="כניסה עם Gmail">
        <div className="clean-login-brand">
          <span>Workday Ledger</span>
          <h1>כניסה למעקב שעות</h1>
          <p>התחברות עם Gmail בלבד לסנכרון הרשומות בין המחשב לסמארטפון.</p>
        </div>

        <div className="clean-login-clock" aria-label="שעון ישראל">
          <span>שעון ישראל</span>
          <strong>{clock.time}</strong>
          <small>{clock.date}</small>
        </div>

        <div className={`clean-weather-card is-${weather.status}`}>
          <span>מזג אוויר לפי מיקום נוכחי</span>
          {weather.status === "ready" ? (
            <>
              <strong>{Math.round(weather.temperature)}°</strong>
              <small>
                {weather.description} · לחות {Math.round(weather.humidity)}% · רוח{" "}
                {Math.round(weather.windSpeed)} קמ״ש
              </small>
            </>
          ) : (
            <>
              <strong>{weather.status === "loading" ? "טוען..." : "לא זמין"}</strong>
              <small>
                {weather.status === "loading"
                  ? "מתחבר ל-API לפי הרשאת המיקום בדפדפן."
                  : weather.message}
              </small>
            </>
          )}
        </div>

        <button
          type="button"
          className="gmail-login-button"
          onClick={handleGoogleSignIn}
          disabled={!firebaseReady || authLoading || isBusy}
        >
          <Cloud size={18} aria-hidden="true" />
          <span>
            {authLoading
              ? "בודק חיבור..."
              : firebaseReady
                ? "כניסה עם Gmail"
                : "Firebase לא מוגדר"}
          </span>
        </button>

        {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
      </section>
    </main>
  );
}

function EnglishLoginPage({
  firebaseReady,
  authLoading,
  syncError,
}: {
  firebaseReady: boolean;
  authLoading: boolean;
  syncError: string | null;
}) {
  const clock = useIsraelClock();
  const weather = useCurrentWeather();
  const [isBusy, setIsBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  async function handleGoogleSignIn() {
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

  const errorMessage = authError ?? syncError;

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

      <section className="clean-login-card liquid-login-card" aria-label="Gmail sign in">
        <div className="clean-login-brand">
          <span>Workday Ledger</span>
          <h1>Work Hours Login</h1>
          <p>Sign in with Gmail to sync work records across desktop and mobile.</p>
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

        <div className="clean-gmail-card" aria-label="Gmail authentication">
          <button
            type="button"
            className="gmail-login-button"
            onClick={handleGoogleSignIn}
            disabled={!firebaseReady || authLoading || isBusy}
          >
            <Cloud size={18} aria-hidden="true" />
            <span>
              {authLoading
                ? "Checking connection..."
                : firebaseReady
                  ? "Continue with Gmail"
                  : "Firebase is not configured"}
            </span>
          </button>

          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
        </div>
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

  if (authLoading || !firebaseUser) {
    return (
      <EnglishLoginPage
        firebaseReady={isFirebaseConfigured}
        authLoading={authLoading}
        syncError={syncError}
      />
    );
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
