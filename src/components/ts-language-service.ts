"use client";

import type * as Monaco from "monaco-editor";

/**
 * Enhanced TypeScript language service that provides repo-aware completions.
 * This supplements the AI completion path with Monaco's built-in TypeScript
 * language features including symbol navigation, hover, and diagnostics.
 */
export class TypeScriptLanguageService {
  private monaco: typeof Monaco;
  private disposables: Monaco.IDisposable[] = [];

  constructor(monaco: typeof Monaco) {
    this.monaco = monaco;
  }

  /**
   * Configure TypeScript defaults for optimal IDE experience.
   * Call this after Monaco mounts.
   */
  configureDefaults(): void {
    const tsDefaults = this.monaco.languages.typescript.typescriptDefaults;

    // Enable JavaScript/TypeScript features
    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    tsDefaults.setCompilerOptions({
      target: this.monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: this.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: this.monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: this.monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: true,
      strict: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"],
        "@/components/*": ["./src/components/*"],
        "@/lib/*": ["./src/lib/*"],
        "@/store/*": ["./src/store/*"]
      }
    });

    // Add common type definitions
    this.addGlobalTypes();
  }

  /**
   * Add common type definitions for better completions.
   */
  private addGlobalTypes(): void {
    const tsDefaults = this.monaco.languages.typescript.typescriptDefaults;

    // React types
    const reactTypes = `
      declare namespace React {
        type ReactNode = import('react').ReactNode;
        type FC<P = {}> = import('react').FunctionComponent<P>;
        type CSSProperties = import('react').CSSProperties;
      }
      declare module 'react' {
        function useState<T>(initial: T | (() => T)): [T, (value: T) => void];
        function useState<T>(): [T | undefined, (value: T) => void];
        function useEffect(effect: () => void | (() => void)): void;
        function useEffect(effect: () => void, deps: any[]): void;
        function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
        function useMemo<T>(factory: () => T, deps: any[]): T;
        function useRef<T>(initial: T): { current: T };
        function useRef<T>(initial?: T): { current: T | undefined };
      }
    `;

    // Next.js types
    const nextTypes = `
      declare namespace Next {
        function dynamic<T>(importFn: () => Promise<T>): T;
        function dynamic<T>(importFn: () => Promise<T>, options: { ssr?: boolean }): T;
      }
      declare module 'next' {
        export function GetServerSideProps(context: any): any;
        export function GetStaticProps(context: any): any;
        export function GetServerSideProps(context: any): any;
      }
    `;

    // Node.js globals
    const nodeTypes = `
      declare module 'node:fs' {
        export function readFile(path: string, encoding: string): Promise<string>;
        export function writeFile(path: string, data: string): Promise<void>;
      }
      declare module 'node:path' {
        export function resolve(...paths: string[]): string;
        export function join(...paths: string[]): string;
      }
    `;

    tsDefaults.addExtraLib(reactTypes, "file:///node_modules/@types/react-global.d.ts");
    tsDefaults.addExtraLib(nextTypes, "file:///node_modules/@types/next-global.d.ts");
    tsDefaults.addExtraLib(nodeTypes, "file:///node_modules/@types/node-global.d.ts");
  }

  /**
   * Add type definitions from an analyzed repo.
   * This enables completions based on actual codebase types.
   */
  addRepoTypes(filePath: string, content: string): void {
    const tsDefaults = this.monaco.languages.typescript.typescriptDefaults;
    tsDefaults.addExtraLib(content, `file:///${filePath}`);
  }

  /**
   * Get TypeScript worker for additional language features.
   */
  getWorker(): Thenable<Monaco.languages.typescript.LanguageWorker> {
    return this.monaco.languages.typescript.getTypeScriptWorker();
  }

  /**
   * Clean up disposables.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

/**
 * Singleton instance accessor.
 */
let languageService: TypeScriptLanguageService | null = null;

export function getTypeScriptLanguageService(monaco: typeof Monaco): TypeScriptLanguageService {
  if (!languageService) {
    languageService = new TypeScriptLanguageService(monaco);
  }
  return languageService;
}