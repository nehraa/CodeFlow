export declare const TERMINAL_REPO_PATH_HEADER = "x-codeflow-repo-path";
export type TerminalSessionStatus = "running" | "exited" | "error";
export type TerminalSessionSummary = {
    id: string;
    title: string;
    cwd: string;
    shell: string;
    status: TerminalSessionStatus;
    startedAt: string;
    lastActivityAt: string;
    exitCode: number | null;
};
export type TerminalSessionSnapshot = TerminalSessionSummary & {
    output: string;
    truncated: boolean;
};
export declare const listTerminalSessions: () => TerminalSessionSummary[];
export declare const getTerminalSession: (id: string) => TerminalSessionSnapshot | null;
export declare const createTerminalSession: (options?: {
    cwd?: string;
    title?: string;
}) => Promise<TerminalSessionSnapshot>;
export declare const writeTerminalInput: (id: string, input: string, options?: {
    echoInput?: boolean;
}) => Promise<TerminalSessionSnapshot>;
export declare const closeTerminalSession: (id: string) => boolean;
export declare const shutdownAllTerminalSessions: () => void;
//# sourceMappingURL=terminal-sessions.d.ts.map