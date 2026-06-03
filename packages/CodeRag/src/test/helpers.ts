import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import type { SerializableCodeRagConfig } from "../types.js";
import { resolveRuntimeConfig } from "../service/config.js";
import { writeJson } from "../utils/filesystem.js";

export const createTempDir = async (prefix: string): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), prefix));

export const cleanupPaths = async (paths: string[]): Promise<void> => {
  await Promise.all(paths.splice(0, paths.length).map((targetPath) => fs.rm(targetPath, { recursive: true, force: true })));
};

const writeTsconfig = async (repoPath: string): Promise<void> => {
  await writeJson(path.join(repoPath, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext"
    },
    include: ["src/**/*.ts", "src/**/*.js"]
  });
};

export const createTempRepo = async (): Promise<string> => {
  const repoPath = await createTempDir("coderag-repo-");
  await writeTsconfig(repoPath);

  await fs.mkdir(path.join(repoPath, "src", "lib"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, "src", "lib", "auth.ts"),
    `export function verifyToken(rawToken: string): string {
  return rawToken.trim();
}

export function requireAuth(rawToken: string): string {
  const token = verifyToken(rawToken);
  if (!token) {
    throw new Error("missing token");
  }
  return token;
}
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, "src", "lib", "api.ts"),
    `import { requireAuth } from "./auth";

export function getSession(rawToken: string): { userId: string } {
  requireAuth(rawToken);
  return { userId: "user-1" };
}
`,
    "utf8"
  );

  return repoPath;
};

export const createComplexRepo = async (includeTsconfig = true): Promise<string> => {
  const repoPath = await createTempDir("coderag-complex-");
  if (includeTsconfig) {
    await writeTsconfig(repoPath);
  }

  await fs.mkdir(path.join(repoPath, "src", "services"), { recursive: true });
  await fs.mkdir(path.join(repoPath, "src", "indexers"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, "src", "services", "repo.ts"),
    `export const normalizePath = (inputPath: string): string => inputPath.trim().toLowerCase();

export class RepoAnalyzer {
  analyze(entryPath: string): string {
    return normalizePath(entryPath);
  }
}

export function analyzeTypeScriptRepo(entryPath: string): string {
  const analyzer = new RepoAnalyzer();
  return analyzer.analyze(entryPath);
}
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, "src", "indexers", "build.ts"),
    `import { analyzeTypeScriptRepo } from "../services/repo";

export function buildBlueprintGraph(repoPath: string): string {
  return analyzeTypeScriptRepo(repoPath);
}
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, "src", "main.ts"),
    `import { buildBlueprintGraph } from "./indexers/build";

export function runAnalysis(repoPath: string): string {
  return buildBlueprintGraph(repoPath);
}
`,
    "utf8"
  );

  return repoPath;
};

export const createRuntimeConfig = (
  repoPath: string,
  overrides: Partial<SerializableCodeRagConfig> = {}
) =>
  resolveRuntimeConfig(
    {
      repoPath,
      storageRoot: path.join(repoPath, ".coderag"),
      retrieval: {
        topK: 6,
        rerankK: 3,
        maxContextChars: 12000,
        ...overrides.retrieval
      },
      traversal: {
        defaultDepth: 1,
        maxDepth: 3,
        ...overrides.traversal
      },
      locking: {
        timeoutMs: 1000,
        pollMs: 20,
        staleMs: 50,
        ...overrides.locking
      },
      service: {
        host: "127.0.0.1",
        port: 0,
        ...overrides.service
      },
      llm: {
        enabled: false,
        transport: "openai-compatible",
        timeoutMs: 1000,
        customHttpFormat: "json",
        headers: {},
        ...overrides.llm
      }
    },
    repoPath
  );

export const listen = async (handler: http.RequestListener): Promise<{ baseUrl: string; server: http.Server }> => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
};

export const closeServer = async (server: http.Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};
