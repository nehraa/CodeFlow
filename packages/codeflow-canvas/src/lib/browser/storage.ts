/**
 * Type stubs for storage utilities.
 * These are browser-specific and should be provided by the consumer.
 */

// Storage key constants
export const AUTO_IMPLEMENT_STORAGE_KEY = "codeflow:auto-implement";
export const LIVE_COMPLETIONS_STORAGE_KEY = "codeflow:live-completions";
export const THEME_STORAGE_KEY = "codeflow:theme";

// Placeholder implementations - consumer should override
export const loadSessionApiKey = (): string => "";
export const storeSessionApiKey = (_key: string): void => {};
export const readLocalBooleanPreference = (_key: string, _defaultValue: boolean): boolean => _defaultValue;
export const readLocalPreference = (_key: string, _defaultValue: string): string => _defaultValue;
export const writeLocalBooleanPreference = (_key: string, _value: boolean): void => {};
export const writeLocalPreference = (_key: string, _value: string): void => {};
export const readRepoPath = (): string => "";
export const writeRepoPath = (_path: string): void => {};