import { describe, expect, it } from "vitest";

import {
  getCodeflowGovernancePrompt,
  withCodeflowGovernance
} from "@/lib/blueprint/prompt-governance";

describe("prompt governance", () => {
  it("loads execution truth rules from the repo governance docs", async () => {
    const prompt = await getCodeflowGovernancePrompt("implementation");

    expect(prompt).toContain("Green means observed pass, not optimism.");
    expect(prompt).toContain("No fake-pass tests.");
    expect(prompt).toContain("Treat model output as untrusted input.");
  });

  it("composes governance text with a route-specific system prompt", async () => {
    const prompt = await withCodeflowGovernance("Base prompt.", "architecture");

    expect(prompt).toContain("Base prompt.");
    expect(prompt).toContain("The following CodeFlow repository instructions are authoritative");
    expect(prompt).toContain("Repo-Specific AI Rules");
  });
});
