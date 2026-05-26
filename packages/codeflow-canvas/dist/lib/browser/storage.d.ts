/**
 * Type stubs for storage utilities.
 * These are browser-specific and should be provided by the consumer.
 */
export declare const AUTO_IMPLEMENT_STORAGE_KEY = "codeflow:auto-implement";
export declare const LIVE_COMPLETIONS_STORAGE_KEY = "codeflow:live-completions";
export declare const THEME_STORAGE_KEY = "codeflow:theme";
export declare const loadSessionApiKey: () => string;
export declare const storeSessionApiKey: (_key: string) => void;
export declare const readLocalBooleanPreference: (_key: string, _defaultValue: boolean) => boolean;
export declare const readLocalPreference: (_key: string, _defaultValue: string) => string;
export declare const writeLocalBooleanPreference: (_key: string, _value: boolean) => void;
export declare const writeLocalPreference: (_key: string, _value: string) => void;
export declare const readRepoPath: () => string;
export declare const writeRepoPath: (_path: string) => void;
//# sourceMappingURL=storage.d.ts.map