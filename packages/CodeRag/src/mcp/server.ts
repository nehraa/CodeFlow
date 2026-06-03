import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type { CodeRag } from "../service/coderag.js";
import type { Logger } from "../types.js";

const serialize = (value: unknown): string => JSON.stringify(value, null, 2);

const DEPTH_SCHEMA = z.number().int().min(0).optional();

/**
 * Checks whether the index is stale and triggers an auto-index if needed.
 */
const ensureIndexIsCurrent = async (coderag: CodeRag, logger?: Logger): Promise<void> => {
  const status = await coderag.status();

  if (!status.indexed) {
    logger?.info("MCP startup: no index found, running initial index.");
    await coderag.index();
    return;
  }

  if (status.modelMismatch === true) {
    logger?.info("MCP startup: embedding model mismatch detected, running full reindex.");
    await coderag.reindex({ full: true });
    return;
  }

  logger?.debug("MCP startup: index is current, no reindex needed.");
};

/**
 * Creates the stdio MCP server that exposes CodeRag retrieval tools.
 */
export const createMcpServer = (coderag: CodeRag): McpServer => {
  const server = new McpServer({
    name: "coderag",
    version: "0.2.1"
  });

  server.registerTool(
    "query",
    {
      title: "Query repository",
      description: "Answer a natural-language question about the indexed repository.",
      inputSchema: {
        question: z.string().min(1),
        depth: DEPTH_SCHEMA,
        multiHop: z.boolean().optional()
      }
    },
    async ({ question, depth, multiHop }) => ({
      content: [{ type: "text", text: serialize(await coderag.query(question, { depth, multiHop })) }]
    })
  );

  server.registerTool(
    "lookup",
    {
      title: "Lookup node",
      description: "Lookup a graph node by id, name, or file path.",
      inputSchema: {
        identifier: z.string().min(1)
      }
    },
    async ({ identifier }) => ({
      content: [{ type: "text", text: serialize(await coderag.lookup(identifier)) }]
    })
  );

  server.registerTool(
    "explain",
    {
      title: "Explain node",
      description: "Explain what a node does and how it relates to the graph.",
      inputSchema: {
        identifier: z.string().min(1),
        depth: DEPTH_SCHEMA
      }
    },
    async ({ identifier, depth }) => ({
      content: [{ type: "text", text: serialize(await coderag.explain(identifier, depth)) }]
    })
  );

  server.registerTool(
    "impact",
    {
      title: "Impact analysis",
      description: "Show what depends on a node.",
      inputSchema: {
        identifier: z.string().min(1),
        depth: DEPTH_SCHEMA
      }
    },
    async ({ identifier, depth }) => ({
      content: [{ type: "text", text: serialize(await coderag.impact(identifier, depth)) }]
    })
  );

  server.registerTool(
    "status",
    {
      title: "Indexer status",
      description: "Return repository indexing and LLM status.",
      inputSchema: {}
    },
    async () => ({
      content: [{ type: "text", text: serialize(await coderag.status()) }]
    })
  );

  return server;
};

/**
 * Connects the CodeRag MCP server to stdio for local tool execution.
 * Auto-indexes on startup if the index is missing or stale.
 */
export const serveStdioMcpServer = async (coderag: CodeRag, options?: { logger?: Logger }): Promise<void> => {
  await ensureIndexIsCurrent(coderag, options?.logger);
  const server = createMcpServer(coderag);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
