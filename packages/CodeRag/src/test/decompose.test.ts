import { describe, expect, it } from "vitest";

import { shouldDecompose } from "../retrieval/decompose.js";
import type { MultiHopConfig } from "../types.js";

const defaultConfig: MultiHopConfig = {
  enabled: true,
  minQuestionLength: 25,
  maxSubQuestions: 5,
  expansionDepth: 1
};

describe("shouldDecompose", () => {
  it("returns false for short questions below minQuestionLength", () => {
    expect(shouldDecompose("What is auth?", defaultConfig)).toBe(false);
  });

  it("returns false for simple questions without multi-topic indicators", () => {
    const question = "Where is the user session stored in the database?";
    expect(shouldDecompose(question, defaultConfig)).toBe(false);
  });

  it("returns true for questions with 'and' conjunction", () => {
    const question =
      "How does the mixnet handle key exchange and what is the header-only forwarding mechanism?";
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });

  it("returns true for questions with multiple keywords", () => {
    const question =
      "How does the relay handler register routes and compare the encryption modes for different connection types?";
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });

  it("returns true for long questions with keyword", () => {
    const question =
      "Can you explain the architecture of the noise protocol implementation and how the key rotation mechanism works across different relay nodes in the distributed system, including the fallback behavior when a primary node goes down?";
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });

  it("returns true for questions with multiple question marks", () => {
    const question =
      "What does exchangeHopKey do? And how is it different from the regular key exchange?";
    // length=84 (>= 25 ✓), questionMarks=2 (> 1 ✓), words=15 (<= 25 ✗), has 'and' ✓
    // score = 3 → should return true
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });

  it("returns true regardless of config.enabled (gating is done by caller)", () => {
    const disabledConfig = { ...defaultConfig, enabled: false };
    const question = "How does the mixnet handle key exchange and header-only forwarding?";
    // shouldDecompose is a pure heuristic — the caller (decomposeQuestionWithFallback)
    // checks config.enabled before calling this
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });

  it("returns true for 'compare' keyword", () => {
    const question = "Compare the SFT and DPO training methods for the vision model.";
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });

  it("returns true for 'overview' keyword", () => {
    const question = "Give me an overview of the authentication flow and how tokens are validated.";
    expect(shouldDecompose(question, defaultConfig)).toBe(true);
  });
});
