import type { TimeEntry } from "../types";
import { loadFromStorage, saveToStorage } from "./localStorageRepository";

const entriesKey = "time-entries";

export function loadTimeEntries(): TimeEntry[] {
  return loadFromStorage<TimeEntry[]>(entriesKey, []);
}

export function saveTimeEntries(entries: TimeEntry[]): void {
  saveToStorage(entriesKey, entries);
}
