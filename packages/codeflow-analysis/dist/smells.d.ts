import { z } from "zod";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
export declare const smellSchema: z.ZodObject<{
    code: z.ZodString;
    severity: z.ZodEnum<["info", "warning", "critical"]>;
    nodeId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    suggestion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    code: string;
    severity: "warning" | "info" | "critical";
    suggestion: string;
    nodeId?: string | undefined;
}, {
    message: string;
    code: string;
    severity: "warning" | "info" | "critical";
    suggestion: string;
    nodeId?: string | undefined;
}>;
export type Smell = z.infer<typeof smellSchema>;
export declare const smellReportSchema: z.ZodObject<{
    analyzedAt: z.ZodString;
    totalSmells: z.ZodNumber;
    smells: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        severity: z.ZodEnum<["info", "warning", "critical"]>;
        nodeId: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        suggestion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: string;
        severity: "warning" | "info" | "critical";
        suggestion: string;
        nodeId?: string | undefined;
    }, {
        message: string;
        code: string;
        severity: "warning" | "info" | "critical";
        suggestion: string;
        nodeId?: string | undefined;
    }>, "many">;
    healthScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    analyzedAt: string;
    totalSmells: number;
    smells: {
        message: string;
        code: string;
        severity: "warning" | "info" | "critical";
        suggestion: string;
        nodeId?: string | undefined;
    }[];
    healthScore: number;
}, {
    analyzedAt: string;
    totalSmells: number;
    smells: {
        message: string;
        code: string;
        severity: "warning" | "info" | "critical";
        suggestion: string;
        nodeId?: string | undefined;
    }[];
    healthScore: number;
}>;
export type SmellReport = z.infer<typeof smellReportSchema>;
/**
 * Detect all architecture smells in a blueprint graph.
 *
 * Smell categories: god-node, hub-node, orphan-node, tight-coupling,
 * unstable-dependency, scattered-responsibility.
 */
export declare const detectSmells: (graph: BlueprintGraph) => SmellReport;
//# sourceMappingURL=smells.d.ts.map