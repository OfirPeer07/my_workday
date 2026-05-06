import type { UserSettings } from "../types";
import { defaultSettings } from "../domain/workSchedule";
import { loadFromStorage, saveToStorage } from "./localStorageRepository";

const settingsKey = "settings";

export function loadSettings(): UserSettings {
  return loadFromStorage<UserSettings>(settingsKey, defaultSettings);
}

export function saveSettings(settings: UserSettings): void {
  saveToStorage(settingsKey, settings);
}
