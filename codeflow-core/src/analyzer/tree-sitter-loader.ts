import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";

export type SupportedLanguage =
  | "go"
  | "python"
  | "c"
  | "cpp"
  | "rust"
  | "typescript"
  | "javascript";

const LANGUAGE_EXTENSIONS: Record<SupportedLanguage, string[]> = {
  go: [".go"],
  python: [".py"],
  c: [".c", ".h"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp"],
  rust: [".rs"],
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx"]
};

const EXTENSION_TO_LANGUAGE: Map<string, SupportedLanguage> = new Map();
for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
  for (const ext of exts) {
    EXTENSION_TO_LANGUAGE.set(ext, lang as SupportedLanguage);
  }
}

const GRAMMAR_PACKAGE_NAMES: Record<SupportedLanguage, string> = {
  go: "tree-sitter-go",
  python: "tree-sitter-python",
  c: "tree-sitter-c",
  cpp: "tree-sitter-cpp",
  rust: "tree-sitter-rust",
  typescript: "tree-sitter-typescript",
  javascript: "tree-sitter-javascript"
};

const WASM_FILE_NAMES: Record<SupportedLanguage, string> = {
  go: "tree-sitter-go.wasm",
  python: "tree-sitter-python.wasm",
  c: "tree-sitter-c.wasm",
  cpp: "tree-sitter-cpp.wasm",
  rust: "tree-sitter-rust.wasm",
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm"
};

let parserInitialized = false;

const initParser = async (): Promise<void> => {
  if (parserInitialized) {
    return;
  }

  await Parser.init();
  parserInitialized = true;
};

const loadedGrammars = new Map<SupportedLanguage, Language>();

const resolveWasmPath = (lang: SupportedLanguage): string => {
  const packageName = GRAMMAR_PACKAGE_NAMES[lang];
  const wasmFileName = WASM_FILE_NAMES[lang];

  try {
    // Use createRequire for ESM compatibility
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve(`${packageName}/package.json`);
    const packageDir = path.dirname(packagePath);
    return path.join(packageDir, wasmFileName);
  } catch {
    // Fallback to import.meta.resolve if available (Node 20.6+)
    try {
      const packageUrl = import.meta.resolve(`${packageName}/package.json`);
      const packagePath = fileURLToPath(packageUrl);
      const packageDir = path.dirname(packagePath);
      return path.join(packageDir, wasmFileName);
    } catch {
      throw new Error(
        `Cannot resolve WASM file for language "${lang}". ` +
        `Ensure "${packageName}" is installed.`
      );
    }
  }
};

export const loadLanguage = async (lang: SupportedLanguage): Promise<Language> => {
  if (loadedGrammars.has(lang)) {
    return loadedGrammars.get(lang)!;
  }

  await initParser();

  const wasmPath = resolveWasmPath(lang);
  const language = await Language.load(wasmPath);
  loadedGrammars.set(lang, language);

  return language;
};

export const createParser = async (lang: SupportedLanguage): Promise<Parser> => {
  await initParser();
  const parser = new Parser();
  const language = await loadLanguage(lang);
  parser.setLanguage(language);
  return parser;
};

export const extensionToLanguage = (ext: string): SupportedLanguage | null =>
  EXTENSION_TO_LANGUAGE.get(ext) ?? null;

export const SUPPORTED_EXTENSIONS = new Set(EXTENSION_TO_LANGUAGE.keys());

export const getLanguageFromPath = (filePath: string): SupportedLanguage | null => {
  const ext = path.extname(filePath);
  return extensionToLanguage(ext);
};

export const resetLoader = (): void => {
  parserInitialized = false;
  loadedGrammars.clear();
};
