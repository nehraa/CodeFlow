import type { SupportedLanguage } from "./tree-sitter-loader.js";
export interface LanguageQueries {
    functions: string;
    classes: string;
    methods: string;
    imports: string;
    calls: string;
    inherits: string;
}
export declare const QUERIES_BY_LANGUAGE: Record<SupportedLanguage, LanguageQueries>;
