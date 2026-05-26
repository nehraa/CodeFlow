import type { ExportResult } from "@abhinav2203/codeflow-core";
export declare const createSandboxDir: (runId: string) => Promise<string>;
export declare const writeDiffManifest: ({ sandboxResult, targetDir }: {
    sandboxResult: ExportResult;
    targetDir: string;
}) => Promise<string>;
export declare const syncSandboxToTarget: ({ sandboxDir, targetDir }: {
    sandboxDir: string;
    targetDir: string;
}) => Promise<void>;
//# sourceMappingURL=sandbox.d.ts.map