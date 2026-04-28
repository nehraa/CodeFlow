import { CodeRag } from "@abhinav2203/coderag";
export interface CodeRagConfig {
    projectName: string;
    repoPath: string;
    docsPath?: string;
    embeddingProvider?: "local-hash" | "gemini";
}
export declare const initCodeRagForProject: (config: CodeRagConfig) => Promise<CodeRag>;
export declare const getCodeRagInstance: () => CodeRag | null;
export declare const closeCodeRagInstance: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map