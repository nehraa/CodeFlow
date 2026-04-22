export type RunCommandOptions = {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    stdoutMaxBytes?: number;
    stderrMaxBytes?: number;
};
export type RunCommandResult = {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    outputCapped: boolean;
    signal: NodeJS.Signals | null;
};
export declare const runCommand: (command: string, args: string[], options: RunCommandOptions) => Promise<RunCommandResult>;
//# sourceMappingURL=run-command.d.ts.map