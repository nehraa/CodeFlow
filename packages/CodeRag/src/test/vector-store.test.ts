import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { IndexingError } from "../errors/index.js";
import { LanceVectorStore, fromRow, toRow } from "../store/vector-store.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

const record = {
  nodeId: "auth",
  name: "requireAuth",
  kind: "function" as const,
  filePath: "src/lib/auth.ts",
  summary: "Handles authentication.",
  signature: "requireAuth(): void",
  doc: "requireAuth handles authentication",
  vector: [1, 0, 0],
  startLine: 1,
  endLine: 4
};

describe("LanceVectorStore", () => {
  it("normalizes row shapes for storage and retrieval", () => {
    const storedRow = toRow({
      ...record,
      signature: undefined as unknown as string
    });

    expect(storedRow.signature).toBe("");
    expect(fromRow(storedRow).signature).toBe("");
    expect(
      fromRow({
        ...storedRow,
        signature: undefined
      }).signature
    ).toBe("");
    expect(fromRow({ ...storedRow, vector: new Float32Array([1, 0, 0]) }).vector).toEqual([1, 0, 0]);
  });

  it("returns empty results before the table exists", async () => {
    const storageRoot = await createTempDir("coderag-lancedb-");
    const store = new LanceVectorStore(storageRoot) as LanceVectorStore & {
      getAllRows: () => Promise<unknown[]>;
    };

    expect(await store.search([1, 0, 0], 1)).toEqual([]);
    expect(await store.get("missing")).toBeNull();
    expect(await store.getMany([])).toEqual([]);
    expect(await store.getAllRows()).toEqual([]);
    expect(await store.getMetadata()).toBeNull();
    await store.reset([]);
    await store.deleteByNodeIds(["missing"]);
    await store.clear();
    await store.close();

    await cleanupPaths([storageRoot]);
  });

  it("resets, searches, reads, upserts, deletes, and closes the store", async () => {
    const storageRoot = await createTempDir("coderag-lancedb-");
    const store = new LanceVectorStore(storageRoot);

    await store.reset([record]);
    expect((await store.search([1, 0, 0], 1))[0]?.nodeId).toBe("auth");
    expect((await store.get("auth"))?.nodeId).toBe("auth");
    expect(await store.getMany(["auth"])).toHaveLength(1);

    await store.upsert([{ ...record, summary: "Updated authentication." }]);
    expect((await store.get("auth"))?.summary).toBe("Updated authentication.");

    await store.reset([{ ...record, summary: "Reset authentication." }]);
    expect((await store.get("auth"))?.summary).toBe("Reset authentication.");

    await store.deleteByNodeIds(["auth"]);
    expect(await store.get("auth")).toBeNull();

    await store.reset([]);
    await store.close();
    await cleanupPaths([storageRoot]);
  });

  it("upserts into a missing table, ignores empty upserts, and preserves undeleted rows", async () => {
    const storageRoot = await createTempDir("coderag-lancedb-");
    const store = new LanceVectorStore(storageRoot);
    const secondRecord = {
      ...record,
      nodeId: "session",
      name: "getSession",
      filePath: "src/lib/api.ts",
      summary: "Loads the current session."
    };

    await store.upsert([record]);
    await store.upsert([]);
    await store.upsert([secondRecord]);
    await store.deleteByNodeIds(["auth"]);

    expect((await store.get("session"))?.nodeId).toBe("session");
    expect(await store.get("auth")).toBeNull();

    await store.close();
    await cleanupPaths([storageRoot]);
  });

  it("queries requested ids directly instead of depending on a prefix scan", async () => {
    const storageRoot = await createTempDir("coderag-lancedb-");
    const store = new LanceVectorStore(storageRoot);
    const records = Array.from({ length: 40 }, (_, index) => ({
      ...record,
      nodeId: `node-${index + 1}`,
      name: `node${index + 1}`,
      filePath: `src/node-${index + 1}.ts`
    }));

    await store.reset(records);

    const fetched = await store.getMany(["node-40", "node-1"]);

    expect(fetched.map((entry) => entry.nodeId)).toEqual(["node-40", "node-1"]);

    await store.close();
    await cleanupPaths([storageRoot]);
  });

  it("throws when vector store metadata is present but invalid", async () => {
    const storageRoot = await createTempDir("coderag-lancedb-");
    const store = new LanceVectorStore(storageRoot);

    await store.setMetadata({ ok: true });
    const metadataPath = `${storageRoot}/lancedb/store-metadata.json`;
    await fs.writeFile(metadataPath, "{", "utf8");

    await expect(store.getMetadata()).rejects.toThrow(IndexingError);

    await store.close();
    await cleanupPaths([storageRoot]);
  });

  it("clears stored rows and metadata", async () => {
    const storageRoot = await createTempDir("coderag-lancedb-");
    const store = new LanceVectorStore(storageRoot);

    expect(await store.getMetadata()).toBeNull();

    await store.reset([record]);
    await store.setMetadata({ schemaVersion: 2, embeddingProvider: "local-hash" });
    await store.clear();

    expect(await store.get("auth")).toBeNull();
    expect(await store.getMetadata()).toBeNull();

    await store.close();
    await cleanupPaths([storageRoot]);
  });
});
