const storagePrefix = "my-workday";

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(`${storagePrefix}:${key}`);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  window.localStorage.setItem(`${storagePrefix}:${key}`, JSON.stringify(value));
}
