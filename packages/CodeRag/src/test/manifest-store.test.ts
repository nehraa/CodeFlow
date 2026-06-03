import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { IndexingError } from "../errors/index.js";
import { ManifestStore } from "../store/manifest-store.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

describe("ManifestStore", () => {
  it("loads empty state when no files exist", async () => {
    const storageRoot = await createTempDir("coderag-state-");
    const store = new ManifestStore(storageRoot);

    expect(await store.loadManifest()).toBeNull();
    expect(await store.loadSnapshot()).toBeNull();
    expect(await store.loadDocuments()).toEqual({});

    await cleanupPaths([storageRoot]);
  });

  it("persists and reloads manifest state", async () => {
    const storageRoot = await createTempDir("coderag-state-");
    const store = new ManifestStore(storageRoot);

    await store.saveManifest({
      schemaVersion: 2,
      generatedAt: "2026-04-01T00:00:00.000Z",
      repoPath: "/repo",
      provider: "test",
      embeddingProvider: "local-hash",
      embeddingModel: "local-hash",
      embeddingDimensions: 256,
      nodes: {},
      fileHashes: {}
    });

    expect(await store.loadManifest()).toEqual({
      schemaVersion: 2,
      generatedAt: "2026-04-01T00:00:00.000Z",
      repoPath: "/repo",
      provider: "test",
      embeddingProvider: "local-hash",
      embeddingModel: "local-hash",
      embeddingDimensions: 256,
      nodes: {},
      fileHashes: {}
    });

    await cleanupPaths([storageRoot]);
  });

  it("throws a structured error when persisted state is invalid", async () => {
    const storageRoot = await createTempDir("coderag-state-");
    const store = new ManifestStore(storageRoot);
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(path.join(storageRoot, "documents.json"), "{", "utf8");

    await expect(store.loadDocuments()).rejects.toThrow(IndexingError);
    await cleanupPaths([storageRoot]);
  });
});
