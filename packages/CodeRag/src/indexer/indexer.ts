import path from "node:path";

import type { CodeRagConfig, GraphSnapshot, IndexManifest, IndexSummary, IndexedNodeDocument } from "../types.js";
import { buildGraphSnapshot } from "../adapters/codeflow-core.js";
import { IndexingError } from "../errors/index.js";
import { ManifestStore } from "../store/manifest-store.js";
import { IndexLock } from "../store/index-lock.js";
import { buildIndexManifest, buildIndexedDocuments, INDEX_SCHEMA_VERSION } from "./documents.js";
import { installPostCommitHook, isPostCommitHookInstalled } from "./git-hook.js";

const diffNodeIds = (
  previousManifest: IndexManifest | null,
  nextManifest: IndexManifest
): {
  removedNodeIds: string[];
  changedNodeIds: string[];
} => {
  if (!previousManifest) {
    return {
      removedNodeIds: [],
      changedNodeIds: Object.keys(nextManifest.nodes)
    };
  }

  const previousIds = new Set(Object.keys(previousManifest.nodes));
  const nextIds = new Set(Object.keys(nextManifest.nodes));
  const removedNodeIds = [...previousIds].filter((nodeId) => !nextIds.has(nodeId));
  const changedNodeIds = Object.entries(nextManifest.nodes)
    .filter(([nodeId, entry]) => {
      const previousEntry = previousManifest.nodes[nodeId];
      return !previousEntry || previousEntry.docHash !== entry.docHash || previousEntry.fileHash !== entry.fileHash;
    })
    .map(([nodeId]) => nodeId);

  return {
    removedNodeIds,
    changedNodeIds
  };
};

const buildIndexSummary = (
  snapshot: GraphSnapshot,
  manifest: IndexManifest,
  documents: Record<string, IndexedNodeDocument>
): IndexSummary => ({
  graph: snapshot.graph,
  manifest,
  snapshot,
  indexedNodeCount: Object.keys(documents).length
});

const formatEmbeddingFingerprint = (embedding: {
  provider: string;
  model: string;
  dimensions: number;
}): string => `${embedding.provider}:${embedding.model}:${embedding.dimensions}`;

/**
 * Indexes the repository graph and persists the resulting search documents.
 */
export class RepoIndexer {
  private readonly manifestStore: ManifestStore;
  private readonly indexLock: IndexLock;
  private readonly configPath: string | null;

  constructor(private readonly config: CodeRagConfig, configPath?: string) {
    this.manifestStore = new ManifestStore(config.storageRoot);
    this.indexLock = new IndexLock(config.storageRoot, config.locking, config.logger);
    this.configPath = configPath ?? null;
  }

  /**
   * Checks if a full reindex is required based on embedding model/schema changes.
   */
  async checkEmbeddingModelMismatch(): Promise<{ mismatch: boolean; expected: string; actual: string | null }> {
    const currentEmbedding = this.config.embeddingProvider;
    if (!currentEmbedding) {
      return { mismatch: false, expected: "unknown", actual: null };
    }

    const expectedFingerprint = {
      provider: currentEmbedding.name,
      model: currentEmbedding.model,
      dimensions: currentEmbedding.dimensions
    };
    const expected = formatEmbeddingFingerprint(expectedFingerprint);
    const manifest = await this.manifestStore.loadManifest();

    if (!manifest) {
      return { mismatch: false, expected, actual: null };
    }

    const actualFingerprint = {
      provider: manifest.embeddingProvider,
      model: manifest.embeddingModel,
      dimensions: manifest.embeddingDimensions
    };
    const actual = formatEmbeddingFingerprint(actualFingerprint);
    const mismatch =
      manifest.schemaVersion !== INDEX_SCHEMA_VERSION ||
      actualFingerprint.provider !== expectedFingerprint.provider ||
      actualFingerprint.model !== expectedFingerprint.model ||
      actualFingerprint.dimensions !== expectedFingerprint.dimensions;

    return { mismatch, expected, actual };
  }

  async loadState(): Promise<{
    manifest: IndexManifest | null;
    snapshot: GraphSnapshot | null;
    documents: Record<string, IndexedNodeDocument>;
  }> {
    const [manifest, snapshot, documents] = await Promise.all([
      this.manifestStore.loadManifest(),
      this.manifestStore.loadSnapshot(),
      this.manifestStore.loadDocuments()
    ]);

    return {
      manifest,
      snapshot,
      documents
    };
  }

  async waitForUnlockedState(): Promise<{
    waited: boolean;
    manifest: IndexManifest | null;
    snapshot: GraphSnapshot | null;
    documents: Record<string, IndexedNodeDocument>;
  }> {
    const waited = await this.indexLock.waitForRelease();
    return {
      waited,
      ...(await this.loadState())
    };
  }

  async reindex(options: { full?: boolean; docsPath?: string } = {}): Promise<IndexSummary> {
    const full = options.full ?? false;
    const { mismatch, expected, actual } = await this.checkEmbeddingModelMismatch();

    if (full) {
      this.config.logger?.info("Running full CodeRag reindex.", {
        expected,
        actual: actual ?? "none"
      });
    } else if (mismatch) {
      this.config.logger?.warn("Incremental reindex requires a matching embedding fingerprint.", {
        expected,
        actual: actual ?? "none"
      });
    } else {
      this.config.logger?.info("Running incremental CodeRag reindex.", {
        expected,
        actual: actual ?? "none"
      });
    }

    return this.index(full, options.docsPath);
  }

  async index(forceFull = false, docsPath?: string): Promise<IndexSummary> {
    const graphProvider = this.config.graphProvider;
    const embeddingProvider = this.config.embeddingProvider;
    const vectorStore = this.config.vectorStore;

    if (!graphProvider || !embeddingProvider || !vectorStore) {
      throw new IndexingError("CodeRag is missing required indexing dependencies.");
    }

    // Check for embedding model mismatch - throws if mismatch detected
    const { mismatch } = await this.checkEmbeddingModelMismatch();
    if (mismatch && !forceFull) {
      throw new IndexingError(
        "Embedding model mismatch detected. Run 'coderag reindex' to rebuild the index with your current model."
      );
    }

    return this.indexLock.withLock("index", async () => {
      const { manifest: previousManifest } = await this.loadState();
      const snapshot = await buildGraphSnapshot(this.config.repoPath, graphProvider);
      const documents = await buildIndexedDocuments(snapshot, embeddingProvider, docsPath, this.config.logger);
      const manifest = await buildIndexManifest(this.config.repoPath, snapshot, documents, embeddingProvider);
      const { removedNodeIds, changedNodeIds } = diffNodeIds(previousManifest, manifest);

      try {
        if (forceFull || !previousManifest) {
          await vectorStore.reset(Object.values(documents));
        } else {
          await vectorStore.deleteByNodeIds(removedNodeIds);
          await vectorStore.upsert(
            changedNodeIds
              .map((nodeId) => documents[nodeId])
              .filter((document): document is IndexedNodeDocument => Boolean(document))
          );
        }
      } catch (error) {
        throw new IndexingError("Failed to persist indexed documents to the vector store.", {
          repoPath: this.config.repoPath
        }, { cause: error });
      }

      await Promise.all([
        this.manifestStore.saveManifest(manifest),
        this.manifestStore.saveSnapshot(snapshot),
        this.manifestStore.saveDocuments(documents),
        vectorStore.setMetadata({
          schemaVersion: manifest.schemaVersion,
          embeddingProvider: manifest.embeddingProvider,
          embeddingModel: manifest.embeddingModel,
          embeddingDimensions: manifest.embeddingDimensions,
          generatedAt: manifest.generatedAt
        })
      ]);

      this.config.logger?.info("Indexed repository", {
        repoPath: path.resolve(this.config.repoPath),
        indexedNodeCount: Object.keys(documents).length,
        fullReindex: forceFull || !previousManifest
      });

      // Auto-install post-commit hook if not already present
      await this.ensurePostCommitHook();

      return buildIndexSummary(snapshot, manifest, documents);
    });
  }

  /**
   * Ensures the post-commit hook is installed after a successful index.
   */
  private async ensurePostCommitHook(): Promise<void> {
    const installed = await isPostCommitHookInstalled(this.config.repoPath);
    if (!installed) {
      this.config.logger?.info("Auto-installing post-commit hook for incremental indexing.");
      await installPostCommitHook(this.config.repoPath, this.configPath, this.config.logger);
    }
  }
}
