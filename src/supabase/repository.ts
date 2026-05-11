import type { Session, User } from "@supabase/supabase-js";
import type { TimeEntry, UserSettings } from "../types";
import { requireSupabase } from "./client";

type TimeEntryRow = {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  source: TimeEntry["source"];
  note: string | null;
};

function toTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    source: row.source,
    note: row.note ?? undefined,
  };
}

function toTimeEntryRow(userId: string, entry: TimeEntry): TimeEntryRow {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    start_time: entry.startTime,
    end_time: entry.endTime,
    source: entry.source,
    note: entry.note ?? null,
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

export function subscribeToAuthState(onChange: (session: Session | null) => void) {
  const {
    data: { subscription },
  } = requireSupabase().auth.onAuthStateChange((_event, session) => onChange(session));

  return () => subscription.unsubscribe();
}

export async function sendEmailSignInLink(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOtp({
    email,
  });

  if (error) {
    throw error;
  }
}

export async function signOutFromSupabase(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) {
    throw error;
  }
}

export async function loadCloudSettings(user: User): Promise<UserSettings | null> {
  const { data, error } = await requireSupabase()
    .from("user_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.settings as UserSettings | null;
}

export async function saveCloudSettings(
  user: User,
  settings: UserSettings,
): Promise<void> {
  const { error } = await requireSupabase().from("user_settings").upsert({
    user_id: user.id,
    settings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function loadCloudEntries(user: User): Promise<TimeEntry[]> {
  const { data, error } = await requireSupabase()
    .from("time_entries")
    .select("id,user_id,date,start_time,end_time,source,note")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as TimeEntryRow[]).map(toTimeEntry);
}

export async function saveCloudEntry(user: User, entry: TimeEntry): Promise<void> {
  const { error } = await requireSupabase().from("time_entries").upsert({
    ...toTimeEntryRow(user.id, entry),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function deleteCloudEntry(user: User, entryId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("time_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("id", entryId);

  if (error) {
    throw error;
  }
}
