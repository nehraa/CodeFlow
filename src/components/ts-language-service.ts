"use client";

import type * as Monaco from "monaco-editor";

type LanguageDefaultsApi = {
  addExtraLib: (content: string, filePath?: string) => Monaco.IDisposable;
  setCompilerOptions: (options: Record<string, unknown>) => void;
  setDiagnosticsOptions: (options: Record<string, unknown>) => void;
};

type MonacoTypeScriptApi = {
  javascriptDefaults: LanguageDefaultsApi;
  typescriptDefaults: LanguageDefaultsApi;
  JsxEmit: {
    ReactJSX?: number;
    React?: number;
  };
  ModuleKind: {
    ESNext: number;
  };
  ModuleResolutionKind: {
    NodeJs: number;
  };
  ScriptTarget: {
    ESNext: number;
  };
};

function getTypeScriptApi(monaco: typeof Monaco): MonacoTypeScriptApi | null {
  return (monaco.languages as unknown as { typescript?: MonacoTypeScriptApi }).typescript ?? null;
}

function toExtraLibPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `file:///${normalized}`;
}

export class TypeScriptLanguageService {
  private monaco: typeof Monaco;
  private defaultsConfigured = false;
  private workspaceLibs = new Map<string, Monaco.IDisposable>();
  private globalLibDisposables: Monaco.IDisposable[] = [];

  constructor(monaco: typeof Monaco) {
    this.monaco = monaco;
  }

  configureDefaults(): void {
    if (this.defaultsConfigured) {
      return;
    }

    const api = getTypeScriptApi(this.monaco);
    if (!api) {
      return;
    }

    const jsxMode = api.JsxEmit.ReactJSX ?? api.JsxEmit.React ?? 2;
    const compilerOptions = {
      allowJs: true,
      allowNonTsExtensions: true,
      baseUrl: ".",
      checkJs: true,
      esModuleInterop: true,
      jsx: jsxMode,
      module: api.ModuleKind.ESNext,
      moduleResolution: api.ModuleResolutionKind.NodeJs,
      noEmit: true,
      paths: {
        "@/*": ["./src/*"],
        "@/components/*": ["./src/components/*"],
        "@/lib/*": ["./src/lib/*"],
        "@/store/*": ["./src/store/*"]
      },
      strict: true,
      target: api.ScriptTarget.ESNext
    };

    api.typescriptDefaults.setCompilerOptions(compilerOptions);
    api.javascriptDefaults.setCompilerOptions(compilerOptions);

    api.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });
    api.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    this.addGlobalTypes(api);
    this.defaultsConfigured = true;
  }

  private addGlobalTypes(api: MonacoTypeScriptApi): void {
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

    this.globalLibDisposables.push(
      api.typescriptDefaults.addExtraLib(reactTypes, "file:///node_modules/@types/react-global.d.ts"),
      api.typescriptDefaults.addExtraLib(nextTypes, "file:///node_modules/@types/next-global.d.ts"),
      api.typescriptDefaults.addExtraLib(nodeTypes, "file:///node_modules/@types/node-global.d.ts")
    );
  }

  upsertWorkspaceFile(filePath: string, content: string): void {
    this.configureDefaults();
    const api = getTypeScriptApi(this.monaco);
    if (!api) {
      return;
    }

    const extraLibPath = toExtraLibPath(filePath);
    this.workspaceLibs.get(extraLibPath)?.dispose();
    this.workspaceLibs.set(extraLibPath, api.typescriptDefaults.addExtraLib(content, extraLibPath));
  }

  dispose(): void {
    this.globalLibDisposables.forEach((disposable) => disposable.dispose());
    this.globalLibDisposables = [];
    this.workspaceLibs.forEach((disposable) => disposable.dispose());
    this.workspaceLibs.clear();
    this.defaultsConfigured = false;
  }
}

let languageService: TypeScriptLanguageService | null = null;

export function getTypeScriptLanguageService(monaco: typeof Monaco): TypeScriptLanguageService {
  if (!languageService) {
    languageService = new TypeScriptLanguageService(monaco);
  }
  return languageService;
}
