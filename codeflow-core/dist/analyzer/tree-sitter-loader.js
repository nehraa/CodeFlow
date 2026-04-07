import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";
const LANGUAGE_EXTENSIONS = {
    go: [".go"],
    python: [".py"],
    c: [".c", ".h"],
    cpp: [".cpp", ".cc", ".cxx", ".hpp"],
    rust: [".rs"],
    typescript: [".ts", ".tsx"],
    javascript: [".js", ".jsx"]
};
const EXTENSION_TO_LANGUAGE = new Map();
for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    for (const ext of exts) {
        EXTENSION_TO_LANGUAGE.set(ext, lang);
    }
}
const GRAMMAR_PACKAGE_NAMES = {
    go: "tree-sitter-go",
    python: "tree-sitter-python",
    c: "tree-sitter-c",
    cpp: "tree-sitter-cpp",
    rust: "tree-sitter-rust",
    typescript: "tree-sitter-typescript",
    javascript: "tree-sitter-javascript"
};
const WASM_FILE_NAMES = {
    go: "tree-sitter-go.wasm",
    python: "tree-sitter-python.wasm",
    c: "tree-sitter-c.wasm",
    cpp: "tree-sitter-cpp.wasm",
    rust: "tree-sitter-rust.wasm",
    typescript: "tree-sitter-typescript.wasm",
    javascript: "tree-sitter-javascript.wasm"
};
let parserInitialized = false;
const initParser = async () => {
    if (parserInitialized) {
        return;
    }
    await Parser.init();
    parserInitialized = true;
};
const loadedGrammars = new Map();
const resolveWasmPath = (lang) => {
    const packageName = GRAMMAR_PACKAGE_NAMES[lang];
    const wasmFileName = WASM_FILE_NAMES[lang];
    try {
        // Use createRequire for ESM compatibility
        const require = createRequire(import.meta.url);
        const packagePath = require.resolve(`${packageName}/package.json`);
        const packageDir = path.dirname(packagePath);
        return path.join(packageDir, wasmFileName);
    }
    catch {
        // Fallback to import.meta.resolve if available (Node 20.6+)
        try {
            const packageUrl = import.meta.resolve(`${packageName}/package.json`);
            const packagePath = fileURLToPath(packageUrl);
            const packageDir = path.dirname(packagePath);
            return path.join(packageDir, wasmFileName);
        }
        catch {
            throw new Error(`Cannot resolve WASM file for language "${lang}". ` +
                `Ensure "${packageName}" is installed.`);
        }
    }
};
export const loadLanguage = async (lang) => {
    if (loadedGrammars.has(lang)) {
        return loadedGrammars.get(lang);
    }
    await initParser();
    const wasmPath = resolveWasmPath(lang);
    const language = await Language.load(wasmPath);
    loadedGrammars.set(lang, language);
    return language;
};
export const createParser = async (lang) => {
    await initParser();
    const parser = new Parser();
    const language = await loadLanguage(lang);
    parser.setLanguage(language);
    return parser;
};
export const extensionToLanguage = (ext) => EXTENSION_TO_LANGUAGE.get(ext) ?? null;
export const SUPPORTED_EXTENSIONS = new Set(EXTENSION_TO_LANGUAGE.keys());
export const getLanguageFromPath = (filePath) => {
    const ext = path.extname(filePath);
    return extensionToLanguage(ext);
};
export const resetLoader = () => {
    parserInitialized = false;
    loadedGrammars.clear();
};
