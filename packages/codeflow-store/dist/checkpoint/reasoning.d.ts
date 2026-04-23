import { z } from "zod";
export declare const reasoningCheckpointSchema: z.ZodObject<{
    runId: z.ZodString;
    projectName: z.ZodString;
    taskId: z.ZodString;
    content: z.ZodString;
    savedAt: z.ZodString;
}, z.core.$strip>;
export interface ReasoningCheckpoint extends z.infer<typeof reasoningCheckpointSchema> {
}
export declare const saveTaskReasoningCheckpoint: (runId: string, projectName: string, taskId: string, content: string) => Promise<ReasoningCheckpoint>;
export declare const loadTaskReasoningCheckpoint: (runId: string, projectName: string, taskId: string) => Promise<ReasoningCheckpoint | null>;
export declare const recoverRun: (runId: string, projectName: string) => Promise<ReasoningCheckpoint[]>;
export declare const clearTaskReasoningCheckpoint: (runId: string, projectName?: string, taskId?: string) => Promise<number>;
//# sourceMappingURL=reasoning.d.ts.map