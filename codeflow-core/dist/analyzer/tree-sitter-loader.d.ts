import { Language, Parser } from "web-tree-sitter";
export type SupportedLanguage = "go" | "python" | "c" | "cpp" | "rust" | "typescript" | "javascript";
export declare const loadLanguage: (lang: SupportedLanguage) => Promise<Language>;
export declare const getParser: () => Promise<Parser>;
export declare const setParserLanguage: (lang: SupportedLanguage) => Promise<Parser>;
export declare const extensionToLanguage: (ext: string) => SupportedLanguage | null;
export declare const SUPPORTED_EXTENSIONS: Set<string>;
export declare const getLanguageFromPath: (filePath: string) => SupportedLanguage | null;
export declare const resetLoader: () => void;
