export type RunCommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
};
export type RunCommandOptions = {
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
    stdoutMaxBytes?: number;
    stderrMaxBytes?: number;
};
export declare function runCommand(command: string, args: string[], options?: RunCommandOptions): Promise<RunCommandResult>;
//# sourceMappingURL=run-command.d.ts.map