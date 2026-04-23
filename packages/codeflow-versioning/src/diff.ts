import { z } from "zod";
import { diffBranches } from "./branch/index";
import {
  blueprintGraphSchema,
  type BlueprintGraph,
  type BranchDiff
} from "@abhinav2203/codeflow-core/schema";

// Use z.custom() to bypass the ZodType compatibility issue with blueprintGraphSchema
const diffRequestSchema = z.object({
  baseGraph: z.custom<BlueprintGraph>((val) => {
    try {
      blueprintGraphSchema.parse(val);
      return true;
    } catch {
      return false;
    }
  }),
  compareGraph: z.custom<BlueprintGraph>((val) => {
    try {
      blueprintGraphSchema.parse(val);
      return true;
    } catch {
      return false;
    }
  }),
  baseId: z.string().optional(),
  compareId: z.string().optional()
});

export const computeDiff = async (payload: {
  baseGraph: BlueprintGraph;
  compareGraph: BlueprintGraph;
  baseId?: string;
  compareId?: string;
}): Promise<BranchDiff> => {
  const parsed = diffRequestSchema.parse(payload);
  return diffBranches(
    parsed.baseGraph,
    parsed.compareGraph,
    parsed.baseId ?? "base",
    parsed.compareId ?? "compare"
  );
};
