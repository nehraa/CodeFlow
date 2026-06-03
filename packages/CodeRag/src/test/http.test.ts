import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeRagError, NotFoundError } from "../errors/index.js";
import { createHttpServer } from "../service/http.js";
import { createRuntimeConfig } from "./helpers.js";

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader: (name: string, value: string) => void;
  writeHead: (statusCode: number, headers?: Record<string, string>) => void;
  end: (value?: string) => void;
};

const createRequest = (
  method: string,
  url: string,
  body?: string,
  headers: Record<string, string> = {},
  encrypted = false
) => ({
  method,
  url,
  headers,
  socket: encrypted ? { encrypted: true } : {},
  async *[Symbol.asyncIterator]() {
    if (body) {
      yield Buffer.from(body);
    }
  }
});

const createResponse = (): MockResponse => ({
  statusCode: 200,
  headers: {},
  body: "",
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    for (const [headerName, headerValue] of Object.entries(headers ?? {})) {
      this.headers[headerName.toLowerCase()] = headerValue;
    }
  },
  end(value) {
    this.body = value ?? "";
  }
});

const invokeServer = async (
  server: ReturnType<typeof createHttpServer>,
  request: ReturnType<typeof createRequest>
): Promise<MockResponse> => {
  const response = createResponse();
  const handler = server.listeners("request")[0] as (request: object, response: object) => Promise<void>;
  await handler(request, response);
  return response;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HTTP service", () => {
  it("serves health, status, query, and metrics endpoints", async () => {
    const coderag = {
      status: async () => ({
        indexed: true,
        indexedNodeCount: 5,
        modelMismatch: false
      }),
      explain: async () => ({ node: { name: "requireAuth" } }),
      impact: async () => ({ node: { name: "requireAuth" } }),
      lookup: async () => ({ node: { name: "requireAuth" } }),
      query: async () => ({ context: { primaryNode: { name: "requireAuth" } } }),
      index: async () => ({ indexedNodeCount: 5 }),
      reindex: async () => ({ indexedNodeCount: 5 })
    } as never;
    const server = createHttpServer(coderag, {
      ...createRuntimeConfig(process.cwd()),
      service: { host: "127.0.0.1", port: 0 }
    });

    const healthResponse = await invokeServer(server, createRequest("GET", "/health", undefined, {}, true));
    const readyResponse = await invokeServer(server, createRequest("GET", "/readyz"));
    const statusResponse = await invokeServer(server, createRequest("GET", "/v1/status"));
    const explainResponse = await invokeServer(
      server,
      createRequest("POST", "/v1/explain", JSON.stringify({ identifier: "requireAuth", depth: 1 }), {
        "content-type": "application/json"
      })
    );
    const impactResponse = await invokeServer(
      server,
      createRequest("POST", "/v1/impact", JSON.stringify({ identifier: "requireAuth", depth: 1 }), {
        "content-type": "application/json"
      })
    );
    const lookupResponse = await invokeServer(
      server,
      createRequest("POST", "/v1/lookup", JSON.stringify({ identifier: "requireAuth" }), {
        "content-type": "application/json"
      })
    );
    const queryResponse = await invokeServer(
      server,
      createRequest("POST", "/v1/query", JSON.stringify({ question: "requireAuth" }), {
        "content-type": "application/json"
      })
    );
    const indexResponse = await invokeServer(
      server,
      createRequest("POST", "/v1/index", JSON.stringify({ full: true }), {
        "content-type": "application/json"
      })
    );
    const reindexResponse = await invokeServer(
      server,
      createRequest("POST", "/v1/reindex", JSON.stringify({ full: true }), {
        "content-type": "application/json"
      })
    );
    const metricsResponse = await invokeServer(server, createRequest("GET", "/metrics"));

    expect(JSON.parse(healthResponse.body).data.ok).toBe(true);
    expect(healthResponse.headers["strict-transport-security"]).toContain("max-age");
    expect(readyResponse.statusCode).toBe(200);
    expect(JSON.parse(readyResponse.body).data.ready).toBe(true);
    expect(JSON.parse(statusResponse.body).data.indexed).toBe(true);
    expect(JSON.parse(explainResponse.body).data.node.name).toBe("requireAuth");
    expect(JSON.parse(impactResponse.body).data.node.name).toBe("requireAuth");
    expect(JSON.parse(lookupResponse.body).data.node.name).toBe("requireAuth");
    expect(JSON.parse(queryResponse.body).data.context.primaryNode.name).toBe("requireAuth");
    expect(JSON.parse(indexResponse.body).data.indexedNodeCount).toBeGreaterThan(0);
    expect(JSON.parse(reindexResponse.body).data.indexedNodeCount).toBeGreaterThan(0);
    expect(metricsResponse.body).toContain('coderag_http_requests_total{route="POST__v1_query"} 1');
  });

  it("returns a failing readiness probe when the index is empty or mismatched", async () => {
    const coderag = {
      status: async () => ({
        indexed: true,
        indexedNodeCount: 0,
        modelMismatch: true
      })
    } as never;
    const server = createHttpServer(coderag, {
      ...createRuntimeConfig(process.cwd()),
      service: { host: "127.0.0.1", port: 0 }
    });

    const readyResponse = await invokeServer(server, createRequest("GET", "/ready"));

    expect(readyResponse.statusCode).toBe(503);
    expect(JSON.parse(readyResponse.body).data.ready).toBe(false);
  });

  it("enforces bearer auth and validates request content types", async () => {
    const config = {
      ...createRuntimeConfig(process.cwd()),
      service: { host: "127.0.0.1", port: 0, apiKey: "secret" }
    };
    const coderag = {} as never;
    const server = createHttpServer(coderag, config);

    const unauthorized = await invokeServer(
      server,
      createRequest("POST", "/v1/query", JSON.stringify({ question: "requireAuth" }), {
        "content-type": "application/json"
      })
    );
    const unsupportedMediaType = await invokeServer(
      server,
      createRequest("POST", "/v1/query", "question=requireAuth", {
        authorization: "Bearer secret",
        "content-type": "text/plain"
      })
    );

    expect(unauthorized.statusCode).toBe(401);
    expect(unsupportedMediaType.statusCode).toBe(415);
  });

  it("returns structured not-found and validation errors", async () => {
    const coderag = {} as never;
    const server = createHttpServer(coderag, createRuntimeConfig(process.cwd()));

    const notFound = await invokeServer(server, createRequest("GET", "/missing"));
    const invalid = await invokeServer(
      server,
      createRequest("POST", "/v1/lookup", JSON.stringify({ identifier: "" }), {
        "content-type": "application/json"
      })
    );

    expect(JSON.parse(notFound.body).error.code).toBe("NOT_FOUND");
    expect(JSON.parse(invalid.body).error.code).toBe("INVALID_REQUEST");
  });

  it("maps thrown not-found errors to 404 responses", async () => {
    const coderag = {
      lookup: async () => {
        throw new NotFoundError("missing");
      }
    } as never;
    const server = createHttpServer(coderag, createRuntimeConfig(process.cwd()));
    const response = await invokeServer(
      server,
      createRequest("POST", "/v1/lookup", JSON.stringify({ identifier: "missing" }), {
        "content-type": "application/json"
      })
    );

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error.code).toBe("NOT_FOUND");
  });

  it("returns request-too-large and internal-error responses", async () => {
    const server = createHttpServer({} as never, createRuntimeConfig(process.cwd()));

    const tooLarge = await invokeServer(
      server,
      createRequest("POST", "/v1/query", "x".repeat(1024 * 1024 + 1), {
        "content-type": "application/json"
      })
    );

    const failingCoderag = {
      status: async () => {
        throw new Error("boom");
      }
    } as never;
    const failingServer = createHttpServer(failingCoderag, {
      ...createRuntimeConfig(process.cwd()),
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    });
    const failingResponse = await invokeServer(failingServer, createRequest("GET", "/v1/status"));

    expect(tooLarge.statusCode).toBe(413);
    expect(JSON.parse(failingResponse.body).error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("rejects malformed JSON bodies with a 400 response", async () => {
    const server = createHttpServer({} as never, createRuntimeConfig(process.cwd()));
    const response = await invokeServer(
      server,
      createRequest("POST", "/v1/query", "{", {
        "content-type": "application/json"
      })
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe("INVALID_REQUEST");
  });

  it("accepts streamed string chunks and falls back to default route keys", async () => {
    const server = createHttpServer(
      {
        lookup: async () => ({ node: { name: "requireAuth" } })
      } as never,
      createRuntimeConfig(process.cwd())
    );
    const response = await invokeServer(server, {
      method: "POST",
      url: "/v1/lookup",
      headers: { "content-type": "application/json" },
      socket: {},
      async *[Symbol.asyncIterator]() {
        yield '{"identifier":"requireAuth"}';
      }
    } as ReturnType<typeof createRequest>);
    const defaultRouteResponse = await invokeServer(server, {
      headers: {},
      socket: {},
      async *[Symbol.asyncIterator]() {}
    } as ReturnType<typeof createRequest>);

    expect(response.statusCode).toBe(200);
    expect(defaultRouteResponse.statusCode).toBe(404);
  });

  it("surfaces unexpected JSON parsing failures as internal errors", async () => {
    const parseSpy = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw new TypeError("bad parse");
    });
    const server = createHttpServer({} as never, createRuntimeConfig(process.cwd()));
    const response = await invokeServer(
      server,
      createRequest("POST", "/v1/query", "{}", {
        "content-type": "application/json"
      })
    );

    expect(parseSpy).toHaveBeenCalled();
    expect(response.statusCode).toBe(500);
  });

  it("returns 400 errors for structured CodeRag errors and supports non-full index requests", async () => {
    const coderag = {
      lookup: async () => {
        throw new CodeRagError("bad request", "BAD_REQUEST");
      },
      reindex: async () => ({ indexedNodeCount: 7 })
    } as never;
    const server = createHttpServer(coderag, createRuntimeConfig(process.cwd()));

    const badLookup = await invokeServer(
      server,
      createRequest("POST", "/v1/lookup", JSON.stringify({ identifier: "requireAuth" }), {
        "content-type": "application/json"
      })
    );
    const nonFullIndex = await invokeServer(
      server,
      createRequest("POST", "/v1/index", JSON.stringify({ full: false }), {
        "content-type": "application/json"
      })
    );

    expect(badLookup.statusCode).toBe(400);
    expect(JSON.parse(nonFullIndex.body).data.indexedNodeCount).toBe(7);
  });

  it("passes the full flag through to reindex routes", async () => {
    const coderag = {
      reindex: vi.fn().mockResolvedValue({ indexedNodeCount: 9 })
    } as never;
    const server = createHttpServer(coderag, createRuntimeConfig(process.cwd()));

    await invokeServer(
      server,
      createRequest("POST", "/v1/index", JSON.stringify({ full: true }), {
        "content-type": "application/json"
      })
    );
    await invokeServer(
      server,
      createRequest("POST", "/v1/reindex", JSON.stringify({ full: false }), {
        "content-type": "application/json"
      })
    );
    await invokeServer(
      server,
      createRequest("POST", "/v1/index", JSON.stringify({}), {
        "content-type": "application/json"
      })
    );

    expect(coderag.reindex).toHaveBeenNthCalledWith(1, { full: true });
    expect(coderag.reindex).toHaveBeenNthCalledWith(2, { full: false });
    expect(coderag.reindex).toHaveBeenNthCalledWith(3, { full: false });
  });
});
