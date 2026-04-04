import { afterEach, describe, expect, it, vi } from "vitest";

const { queryMock, statusMock, getCodeRagMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  statusMock: vi.fn(),
  getCodeRagMock: vi.fn()
}));

vi.mock("@/lib/coderag", () => ({
  getCodeRag: getCodeRagMock
}));

import { GET, POST } from "@/app/api/coderag/route";

afterEach(() => {
  queryMock.mockReset();
  statusMock.mockReset();
  getCodeRagMock.mockReset();
});

describe("/api/coderag", () => {
  it("returns not_initialized when the index is unavailable", async () => {
    getCodeRagMock.mockReturnValue(null);

    const response = await GET();
    const body = (await response.json()) as { status?: string; message?: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("not_initialized");
    expect(body.message).toContain("Build or export");
  });

  it("returns validated query results for a repo search", async () => {
    queryMock.mockResolvedValue({
      question: "Where is auth validated?",
      answerMode: "context-only",
      answer: "validateAuth handles JWT verification.",
      context: {
        graphSummary: "validateAuth -> jwtVerify",
        warnings: [],
        primaryNode: null,
        relatedNodes: []
      }
    });
    getCodeRagMock.mockReturnValue({
      query: queryMock
    });

    const response = await POST(
      new Request("http://localhost/api/coderag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "Where is auth validated?",
          depth: 3
        })
      })
    );
    const body = (await response.json()) as {
      results?: { answer: string; question: string };
    };

    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith("Where is auth validated?", { depth: 3 });
    expect(body.results?.answer).toContain("validateAuth");
  });

  it("rejects an empty query string", async () => {
    const response = await POST(
      new Request("http://localhost/api/coderag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "   "
        })
      })
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Query string is required");
  });

  it("returns ready status details when the index exists", async () => {
    statusMock.mockResolvedValue({
      storageRoot: "/tmp/coderag",
      indexedNodeCount: 12
    });
    getCodeRagMock.mockReturnValue({
      status: statusMock
    });

    const response = await GET();
    const body = (await response.json()) as {
      status?: string;
      details?: { storageRoot?: string; indexedNodeCount?: number };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(statusMock).toHaveBeenCalledTimes(1);
    expect(body.details?.indexedNodeCount).toBe(12);
  });
});
