/**
 * Type stubs for storage utilities.
 * These are browser-specific and should be provided by the consumer.
 */
// Storage key constants
export const AUTO_IMPLEMENT_STORAGE_KEY = "codeflow:auto-implement";
export const LIVE_COMPLETIONS_STORAGE_KEY = "codeflow:live-completions";
export const THEME_STORAGE_KEY = "codeflow:theme";
// Placeholder implementations - consumer should override
export const loadSessionApiKey = () => "";
export const storeSessionApiKey = (_key) => { };
export const readLocalBooleanPreference = (_key, _defaultValue) => _defaultValue;
export const readLocalPreference = (_key, _defaultValue) => _defaultValue;
export const writeLocalBooleanPreference = (_key, _value) => { };
export const writeLocalPreference = (_key, _value) => { };
export const readRepoPath = () => "";
export const writeRepoPath = (_path) => { };
//# sourceMappingURL=storage.js.map