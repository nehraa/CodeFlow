"use client";

export const LEGACY_NVIDIA_API_KEY_STORAGE_KEY = "nvidia_api_key";
export const NVIDIA_API_KEY_SESSION_STORAGE_KEY = "codeflow_nvidia_api_key_session";
export const LIVE_COMPLETIONS_STORAGE_KEY = "codeflow_live_completions";
export const AUTO_IMPLEMENT_STORAGE_KEY = "codeflow_auto_implement";
export const THEME_STORAGE_KEY = "codeflow_theme";

type StorageKind = "local" | "session";

function getStorage(kind: StorageKind) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredValue(kind: StorageKind, key: string) {
  return getStorage(kind)?.getItem(key) ?? null;
}

function writeStoredValue(kind: StorageKind, key: string, value: string | null) {
  const storage = getStorage(kind);
  if (!storage) {
    return;
  }

  if (value === null || value === "") {
    storage.removeItem(key);
    return;
  }

  storage.setItem(key, value);
}

export function readLocalBooleanPreference(key: string) {
  const value = readStoredValue("local", key);
  if (value === null) {
    return null;
  }

  return value === "true";
}

export function readLocalPreference(key: string) {
  return readStoredValue("local", key);
}

export function writeLocalBooleanPreference(key: string, value: boolean) {
  writeStoredValue("local", key, String(value));
}

export function writeLocalPreference(key: string, value: string | null) {
  writeStoredValue("local", key, value);
}

export function loadSessionApiKey() {
  const sessionValue = readStoredValue("session", NVIDIA_API_KEY_SESSION_STORAGE_KEY)?.trim();
  if (sessionValue) {
    return sessionValue;
  }

  const legacyValue = readStoredValue("local", LEGACY_NVIDIA_API_KEY_STORAGE_KEY)?.trim();
  if (!legacyValue) {
    return "";
  }

  writeStoredValue("session", NVIDIA_API_KEY_SESSION_STORAGE_KEY, legacyValue);
  writeStoredValue("local", LEGACY_NVIDIA_API_KEY_STORAGE_KEY, null);
  return legacyValue;
}

export function storeSessionApiKey(value: string) {
  const trimmed = value.trim();
  writeStoredValue("session", NVIDIA_API_KEY_SESSION_STORAGE_KEY, trimmed || null);
  writeStoredValue("local", LEGACY_NVIDIA_API_KEY_STORAGE_KEY, null);
}
