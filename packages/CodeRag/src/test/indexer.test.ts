import { describe, expect, it, vi } from "vitest";

import { IndexingError } from "../errors/index.js";
import { RepoIndexer } from "../indexer/indexer.js";
import { cleanupPaths, createRuntimeConfig, createTempRepo } from "./helpers.js";

describe("RepoIndexer", () => {
  it("reports unlocked state when no index is in progress", async () => {
    const repoPath = await createTempRepo();
    const indexer = new RepoIndexer(createRuntimeConfig(repoPath));

    const state = await indexer.waitForUnlockedState();
    expect(state.waited).toBe(false);

    await cleanupPaths([repoPath]);
  });

  it("fails fast when required dependencies are missing", async () => {
    const repoPath = await createTempRepo();
    const config = createRuntimeConfig(repoPath);
    config.graphProvider = undefined;
    const indexer = new RepoIndexer(config);

    await expect(indexer.index()).rejects.toThrow(IndexingError);
    await cleanupPaths([repoPath]);
  });

  it("wraps vector-store persistence failures with indexing context", async () => {
    const repoPath = await createTempRepo();
    const config = createRuntimeConfig(repoPath);
    config.vectorStore = {
      async reset() {
        throw new Error("boom");
      },
      async deleteByNodeIds() {},
      async upsert() {},
      async search() {
        return [];
      },
      async get() {
        return null;
      },
      async getMany() {
        return [];
      },
      async close() {},
      async getMetadata() {
        return null;
      },
      async setMetadata() {},
      async clear() {}
    };
    const indexer = new RepoIndexer(config);

    await expect(indexer.index()).rejects.toThrow(IndexingError);
    await cleanupPaths([repoPath]);
  });

  it("routes incremental and full reindex requests to the correct index mode", async () => {
    const repoPath = await createTempRepo();
    const indexer = new RepoIndexer(createRuntimeConfig(repoPath));
    const indexSpy = vi.spyOn(indexer, "index").mockResolvedValue({} as never);

    await indexer.reindex({ full: false });
    await indexer.reindex({ full: true });

    expect(indexSpy).toHaveBeenNthCalledWith(1, false, undefined);
    expect(indexSpy).toHaveBeenNthCalledWith(2, true, undefined);
    await cleanupPaths([repoPath]);
  });

  it("reports unknown embedding fingerprints when no provider is configured", async () => {
    const repoPath = await createTempRepo();
    const config = createRuntimeConfig(repoPath);
    config.embeddingProvider = undefined;
    const indexer = new RepoIndexer(config);

    await expect(indexer.checkEmbeddingModelMismatch()).resolves.toEqual({
      mismatch: false,
      expected: "unknown",
      actual: null
    });
    await cleanupPaths([repoPath]);
  });

  it("warns when an incremental reindex is requested against a mismatched embedding fingerprint", async () => {
    const repoPath = await createTempRepo();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const config = createRuntimeConfig(repoPath);
    config.logger = logger;
    const indexer = new RepoIndexer(config);
    vi.spyOn(indexer, "checkEmbeddingModelMismatch").mockResolvedValue({
      mismatch: true,
      expected: "local-hash:local-hash:256",
      actual: null
    });
    const indexSpy = vi.spyOn(indexer, "index").mockResolvedValue({} as never);

    await indexer.reindex({ full: false });

    expect(logger.warn).toHaveBeenCalled();
    expect(indexSpy).toHaveBeenCalledWith(false, undefined);
    await cleanupPaths([repoPath]);
  });

  it("defaults reindex requests to incremental mode and logs missing prior fingerprints", async () => {
    const repoPath = await createTempRepo();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const config = createRuntimeConfig(repoPath);
    config.logger = logger;
    const indexer = new RepoIndexer(config);
    vi.spyOn(indexer, "checkEmbeddingModelMismatch").mockResolvedValue({
      mismatch: false,
      expected: "local-hash:local-hash:256",
      actual: null
    });
    const indexSpy = vi.spyOn(indexer, "index").mockResolvedValue({} as never);

    await indexer.reindex();

    expect(logger.info).toHaveBeenCalledWith("Running incremental CodeRag reindex.", {
      expected: "local-hash:local-hash:256",
      actual: "none"
    });
    expect(indexSpy).toHaveBeenCalledWith(false, undefined);
    await cleanupPaths([repoPath]);
  });

  it("throws before indexing when an incremental index sees a mismatched fingerprint", async () => {
    const repoPath = await createTempRepo();
    const indexer = new RepoIndexer(createRuntimeConfig(repoPath));
    vi.spyOn(indexer, "checkEmbeddingModelMismatch").mockResolvedValue({
      mismatch: true,
      expected: "local-hash:local-hash:256",
      actual: "gemini:models/other:768"
    });

    await expect(indexer.index(false)).rejects.toThrow(
      "Embedding model mismatch detected. Run 'coderag reindex' to rebuild the index with your current model."
    );
    await cleanupPaths([repoPath]);
  });
});
