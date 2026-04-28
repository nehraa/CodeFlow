import { z } from "zod";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
export declare const smellSchema: z.ZodObject<{
    code: z.ZodString;
    severity: z.ZodEnum<{
        warning: "warning";
        info: "info";
        critical: "critical";
    }>;
    nodeId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    suggestion: z.ZodString;
}, z.core.$strip>;
export type Smell = z.infer<typeof smellSchema>;
export declare const smellReportSchema: z.ZodObject<{
    analyzedAt: z.ZodString;
    totalSmells: z.ZodNumber;
    smells: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        severity: z.ZodEnum<{
            warning: "warning";
            info: "info";
            critical: "critical";
        }>;
        nodeId: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        suggestion: z.ZodString;
    }, z.core.$strip>>;
    healthScore: z.ZodNumber;
}, z.core.$strip>;
export type SmellReport = z.infer<typeof smellReportSchema>;
/**
 * Detect all architecture smells in a blueprint graph.
 *
 * Smell categories: god-node, hub-node, orphan-node, tight-coupling,
 * unstable-dependency, scattered-responsibility.
 */
export declare const detectSmells: (graph: BlueprintGraph) => SmellReport;
//# sourceMappingURL=smells.d.ts.map