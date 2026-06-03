import { describe, expect, it } from "vitest";

import { buildMessages, buildSystemPrompt } from "../llm/prompt.js";

const context = {
  question: "where is auth handled?",
  answerMode: "context-only" as const,
  primaryNode: {
    nodeId: "primary",
    name: "requireAuth",
    kind: "function" as const,
    filePath: "src/lib/auth.ts",
    fullFileContent: "export function requireAuth(token: string) { return verifyToken(token); }",
    startLine: 1,
    endLine: 3,
    callSiteLines: [],
    doc: "requireAuth validates auth tokens.",
    relationship: "primary" as const
  },
  relatedNodes: [
    {
      nodeId: "related-same-file",
      name: "verifyToken",
      kind: "function" as const,
      filePath: "src/lib/auth.ts",
      fullFileContent: "DUPLICATE FILE CONTENT",
      startLine: 5,
      endLine: 7,
      callSiteLines: [2],
      doc: "verifyToken parses the auth token.",
      relationship: "calls" as const
    },
    {
      nodeId: "related-other-file",
      name: "getSession",
      kind: "function" as const,
      filePath: "src/lib/api.ts",
      fullFileContent: "export function getSession() { return requireAuth('token'); }",
      startLine: 1,
      endLine: 3,
      callSiteLines: [8],
      doc: "getSession calls requireAuth to enforce access.",
      relationship: "called-by" as const
    }
  ],
  graphSummary: "Primary node: requireAuth. It depends on: verifyToken. It is used by: getSession.",
  warnings: ["Truncated src/lib/api.ts to stay within the context budget."]
};

describe("prompt builder", () => {
  const testLimits = {
    primaryDoc: 1200,
    primaryFile: 4000,
    relatedDoc: 320,
    relatedFile: 1200
  };
  const tinyLimits = {
    primaryDoc: 20,
    primaryFile: 24,
    relatedDoc: 22,
    relatedFile: 26
  };

  it("builds the system prompt and a compact user context", () => {
    const userMessage = buildMessages("where is auth handled?", context, testLimits)[1]?.content ?? "";

    expect(buildSystemPrompt()).toContain("Only use the provided repository context.");
    expect(userMessage).toContain("Graph summary:");
    expect(userMessage).toContain("Primary node:");
    expect(userMessage).toContain("name=requireAuth");
    expect(userMessage).toContain("verifyToken");
    expect(userMessage).toContain("getSession");
    expect(userMessage).toContain("Warnings:");
    expect(userMessage).not.toContain("\"graphSummary\"");
    expect(userMessage).not.toContain("DUPLICATE FILE CONTENT");
    expect(userMessage).not.toContain("...[truncated]");
    expect(userMessage.length).toBeLessThan(1_500);
  });

  it("applies caller-provided limits when truncating docs and file excerpts", () => {
    const userMessage = buildMessages("where is auth handled?", context, tinyLimits)[1]?.content ?? "";

    expect(userMessage).toContain("Primary doc:\nrequi\n...[truncated]");
    expect(userMessage).toContain("File excerpt:\nexport fu\n...[truncated]");
    expect(userMessage).toContain("Related doc:\nverifyT\n...[truncated]");
    expect(userMessage).toContain("Related doc:\ngetSess\n...[truncated]");
    expect(userMessage).toContain("File excerpt:\nexport func\n...[truncated]");
    expect(userMessage).not.toContain("DUPLICATE FILE CONTENT");
  });

  it("renders a missing primary node without related entries", () => {
    const userMessage =
      buildMessages("where is auth handled?", {
        ...context,
        primaryNode: null,
        relatedNodes: [],
        warnings: []
      }, testLimits)[1]?.content ?? "";

    expect(userMessage).toContain("Primary node:\nnone");
    expect(userMessage).toContain("Related nodes:\nnone");
    expect(userMessage).not.toContain("Warnings:");
    expect(userMessage).not.toContain("...[truncated]");
  });

  it("omits blank related docs and file excerpts when there is no primary node", () => {
    const userMessage =
      buildMessages("where is auth handled?", {
        ...context,
        primaryNode: null,
        relatedNodes: [
          {
            nodeId: "related-blank",
            name: "blankNode",
            kind: "function",
            filePath: "src/blank.ts",
            fullFileContent: "   ",
            startLine: 1,
            endLine: 1,
            callSiteLines: [],
            doc: "   ",
            relationship: "calls"
          }
        ],
        warnings: new Array(6).fill("warning message that should appear only in the capped warning list")
      }, testLimits)[1]?.content ?? "";

    expect(userMessage).toContain("1. name=blankNode | relationship=calls | kind=function | file=src/blank.ts:1-1 | callSites=none");
    expect(userMessage).not.toContain("Related doc:");
    expect(userMessage).not.toContain("File excerpt:");
    expect(userMessage.match(/warning message/g)?.length).toBe(4);
    expect(userMessage).not.toContain("...[truncated]");
  });
});
