import type * as Monaco from "monaco-editor";
export declare class TypeScriptLanguageService {
    private monaco;
    private defaultsConfigured;
    private workspaceLibs;
    private globalLibDisposables;
    constructor(monaco: typeof Monaco);
    configureDefaults(): void;
    private addGlobalTypes;
    upsertWorkspaceFile(filePath: string, content: string): void;
    dispose(): void;
}
export declare function getTypeScriptLanguageService(monaco: typeof Monaco): TypeScriptLanguageService;
//# sourceMappingURL=ts-language-service.d.ts.map