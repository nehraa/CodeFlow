import { randomUUID, timingSafeEqual } from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";

import { z } from "zod";

import { CodeRagError, NotFoundError } from "../errors/index.js";
import type { CodeRag } from "./coderag.js";
import { HttpMetricsCollector } from "./http-metrics.js";
import type { CodeRagConfig } from "../types.js";

const MAX_REQUEST_BYTES = 1024 * 1024;
const JSON_CONTENT_TYPE = "application/json";

const depthSchema = z.number().int().min(0).optional();
const queryBodySchema = z.object({
  question: z.string().min(1),
  depth: depthSchema,
  includeAnswer: z.boolean().optional(),
  multiHop: z.boolean().optional()
});
const identifierBodySchema = z.object({
  identifier: z.string().min(1),
  depth: depthSchema
});
const reindexBodySchema = z.object({
  full: z.boolean().optional()
});

type HttpRouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string
) => Promise<void>;

const applySecurityHeaders = (request: IncomingMessage, response: ServerResponse): void => {
  response.setHeader("content-security-policy", "default-src 'none'");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("cache-control", "no-store");
  if ("encrypted" in request.socket && request.socket.encrypted) {
    response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
};

const writeJson = (
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  requestId: string,
  payload: Record<string, unknown>
): void => {
  applySecurityHeaders(request, response);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId
  });
  response.end(`${JSON.stringify(payload)}\n`);
};

const writeText = (
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  requestId: string,
  payload: string
): void => {
  applySecurityHeaders(request, response);
  response.writeHead(statusCode, {
    "content-type": "text/plain; version=0.0.4; charset=utf-8",
    "x-request-id": requestId
  });
  response.end(payload);
};

const requiresAuth = (pathname: string): boolean => pathname.startsWith("/v1/");

const isAuthorized = (request: IncomingMessage, apiKey: string | undefined): boolean => {
  if (!apiKey) {
    return true;
  }

  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    return false;
  }

  const expected = `Bearer ${apiKey}`;
  if (authorization.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
};

const hasJsonContentType = (request: IncomingMessage): boolean => {
  const contentType = request.headers["content-type"];
  return typeof contentType === "string" && contentType.toLowerCase().includes(JSON_CONTENT_TYPE);
};

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new CodeRagError("Request body exceeded the maximum allowed size.", "REQUEST_TOO_LARGE");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
};

const readJsonBody = async <Value>(
  request: IncomingMessage,
  schema: z.ZodSchema<Value>
): Promise<Value> => {
  if (!hasJsonContentType(request)) {
    throw new CodeRagError("Requests must use application/json content-type.", "UNSUPPORTED_MEDIA_TYPE");
  }

  const rawBody = await readRequestBody(request);
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CodeRagError("Request body must contain valid JSON.", "INVALID_REQUEST");
    }

    throw error;
  }

  return schema.parse(parsed);
};

const errorStatusCode = (error: unknown): number => {
  if (error instanceof NotFoundError) {
    return 404;
  }

  if (error instanceof z.ZodError) {
    return 400;
  }

  if (error instanceof CodeRagError) {
    if (error.code === "UNSUPPORTED_MEDIA_TYPE") {
      return 415;
    }

    if (error.code === "REQUEST_TOO_LARGE") {
      return 413;
    }

    return 400;
  }

  return 500;
};

const errorResponse = (error: unknown): { code: string; message: string; details?: unknown } => {
  if (error instanceof z.ZodError) {
    return {
      code: "INVALID_REQUEST",
      message: "Request validation failed.",
      details: error.flatten()
    };
  }

  if (error instanceof CodeRagError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "An error occurred."
  };
};

const isReadyStatus = (status: Record<string, unknown>): boolean =>
  status.indexed === true &&
  typeof status.indexedNodeCount === "number" &&
  status.indexedNodeCount > 0 &&
  status.modelMismatch === false;

const createQueryHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const body = await readJsonBody(request, queryBodySchema);
  const result = await coderag.query(body.question, {
    depth: body.depth,
    includeAnswer: body.includeAnswer,
    multiHop: body.multiHop
  });
  writeJson(request, response, 200, requestId, { data: result, requestId });
};

const createLookupHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const body = await readJsonBody(request, identifierBodySchema.pick({ identifier: true }));
  writeJson(request, response, 200, requestId, { data: await coderag.lookup(body.identifier), requestId });
};

const createExplainHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const body = await readJsonBody(request, identifierBodySchema);
  writeJson(request, response, 200, requestId, { data: await coderag.explain(body.identifier, body.depth), requestId });
};

const createImpactHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const body = await readJsonBody(request, identifierBodySchema);
  writeJson(request, response, 200, requestId, { data: await coderag.impact(body.identifier, body.depth), requestId });
};

const createIndexHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const body = await readJsonBody(request, reindexBodySchema);
  const result = await coderag.reindex({ full: body.full ?? false });
  writeJson(request, response, 200, requestId, { data: result, requestId });
};

const createReindexHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const body = await readJsonBody(request, reindexBodySchema);
  writeJson(request, response, 200, requestId, {
    data: await coderag.reindex({ full: body.full }),
    requestId
  });
};

const createStatusHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  writeJson(request, response, 200, requestId, { data: await coderag.status(), requestId });
};

const createHealthHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  writeJson(request, response, 200, requestId, { data: { ok: true, status: await coderag.status() }, requestId });
};

const createReadyHandler = (coderag: CodeRag): HttpRouteHandler => async (request, response, requestId) => {
  const status = await coderag.status();
  const ready = isReadyStatus(status);
  writeJson(request, response, ready ? 200 : 503, requestId, {
    data: { ready, status },
    requestId
  });
};

const createMetricsHandler = (metrics: HttpMetricsCollector): HttpRouteHandler => async (request, response, requestId) => {
  writeText(request, response, 200, requestId, metrics.render());
};

const notFoundHandler: HttpRouteHandler = async (request, response, requestId) => {
  writeJson(request, response, 404, requestId, {
    error: {
      code: "NOT_FOUND",
      message: "The requested route does not exist."
    },
    requestId
  });
};

const getRouteHandler = (coderag: CodeRag, metrics: HttpMetricsCollector): Map<string, HttpRouteHandler> =>
  new Map<string, HttpRouteHandler>([
    ["POST /v1/query", createQueryHandler(coderag)],
    ["POST /v1/lookup", createLookupHandler(coderag)],
    ["POST /v1/explain", createExplainHandler(coderag)],
    ["POST /v1/impact", createImpactHandler(coderag)],
    ["POST /v1/index", createIndexHandler(coderag)],
    ["POST /v1/reindex", createReindexHandler(coderag)],
    ["GET /v1/status", createStatusHandler(coderag)],
    ["GET /health", createHealthHandler(coderag)],
    ["GET /healthz", createHealthHandler(coderag)],
    ["GET /ready", createReadyHandler(coderag)],
    ["GET /readyz", createReadyHandler(coderag)],
    ["GET /metrics", createMetricsHandler(metrics)]
  ]);

const createRouteKey = (method: string | undefined, pathname: string): string => `${method ?? "GET"} ${pathname}`;

/**
 * Creates the built-in HTTP API server for CodeRag.
 */
export const createHttpServer = (coderag: CodeRag, config: CodeRagConfig): http.Server => {
  const metrics = new HttpMetricsCollector();
  const routeHandlers = getRouteHandler(coderag, metrics);

  return http.createServer(async (request, response) => {
    const requestId = randomUUID();
    const startTime = Date.now();
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const routeKey = createRouteKey(request.method, url.pathname);
    const routeHandler = routeHandlers.get(routeKey) ?? notFoundHandler;

    try {
      if (requiresAuth(url.pathname) && !isAuthorized(request, config.service.apiKey)) {
        writeJson(request, response, 401, requestId, {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid bearer token."
          },
          requestId
        });
        metrics.record(routeKey, Date.now() - startTime, true);
        return;
      }

      await routeHandler(request, response, requestId);
      metrics.record(routeKey, Date.now() - startTime, false);
    } catch (error) {
      const statusCode = errorStatusCode(error);
      const serializedError = errorResponse(error);

      config.logger?.error("CodeRag HTTP request failed.", {
        requestId,
        method: request.method,
        pathname: url.pathname,
        statusCode,
        errorCode: serializedError.code
      });
      writeJson(request, response, statusCode, requestId, {
        error: serializedError,
        requestId
      });
      metrics.record(routeKey, Date.now() - startTime, true);
    }
  });
};

/**
 * Starts the built-in HTTP API server and resolves once it is listening.
 */
export const serveHttpServer = async (coderag: CodeRag, config: CodeRagConfig): Promise<http.Server> => {
  const server = createHttpServer(coderag, config);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.service.port, config.service.host, () => {
      server.off("error", reject);
      config.logger?.info("CodeRag HTTP server started.", {
        host: config.service.host,
        port: config.service.port
      });
      resolve();
    });
  });

  return server;
};
