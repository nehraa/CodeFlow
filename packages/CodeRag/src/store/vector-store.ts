import fs from "node:fs/promises";
import path from "node:path";

import * as lancedb from "@lancedb/lancedb";

import { IndexingError } from "../errors/index.js";
import type { IndexedNodeDocument, VectorStore } from "../types.js";
import { ensureDir, fileExists, readJson, writeJson } from "../utils/filesystem.js";

const TABLE_NAME = "node_documents";
const METADATA_FILE = "store-metadata.json";

const DELETE_ALL_FILTER = "`nodeId` IS NOT NULL";

const toSqlStringLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const createNodeIdFilter = (nodeIds: string[]): string => `\`nodeId\` IN (${nodeIds.map(toSqlStringLiteral).join(", ")})`;

export const toRow = (record: IndexedNodeDocument): Record<string, unknown> => ({
  nodeId: record.nodeId,
  name: record.name,
  kind: record.kind,
  filePath: record.filePath,
  summary: record.summary,
  signature: record.signature ?? "",
  doc: record.doc,
  vector: record.vector,
  startLine: record.startLine,
  endLine: record.endLine
});

export const fromRow = (record: Record<string, unknown>): IndexedNodeDocument => ({
  nodeId: String(record.nodeId),
  name: String(record.name),
  kind: record.kind as IndexedNodeDocument["kind"],
  filePath: String(record.filePath),
  summary: String(record.summary),
  signature: String(record.signature ?? ""),
  doc: String(record.doc),
  vector: Array.isArray(record.vector) ? record.vector.map(Number) : Array.from(record.vector as Iterable<number>).map(Number),
  startLine: Number(record.startLine),
  endLine: Number(record.endLine)
});

export class LanceVectorStore implements VectorStore {
  private readonly dbPath: string;
  private connectionPromise?: Promise<Awaited<ReturnType<typeof lancedb.connect>>>;

  constructor(storageRoot: string) {
    this.dbPath = path.join(storageRoot, "lancedb");
  }

  private async getConnection() {
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        await ensureDir(this.dbPath);
        return lancedb.connect(this.dbPath);
      })();
    }

    return this.connectionPromise;
  }

  private async getTable() {
    const connection = await this.getConnection();
    const tableNames = await connection.tableNames();
    if (!tableNames.includes(TABLE_NAME)) {
      return null;
    }

    return connection.openTable(TABLE_NAME);
  }

  private async getAllRows(): Promise<IndexedNodeDocument[]> {
    const table = await this.getTable();
    if (!table) {
      return [];
    }

    const rows = await table.query().toArray();
    return rows.map((row) => fromRow(row as Record<string, unknown>));
  }

  async reset(records: IndexedNodeDocument[]): Promise<void> {
    if (records.length === 0) {
      const table = await this.getTable();
      if (!table) {
        return;
      }

      await table.delete(DELETE_ALL_FILTER);
      return;
    }

    const connection = await this.getConnection();
    const tableNames = await connection.tableNames();

    if (!tableNames.includes(TABLE_NAME)) {
      await connection.createTable(TABLE_NAME, records.map(toRow));
      return;
    }

    const table = await connection.openTable(TABLE_NAME);
    await table.add(records.map(toRow), { mode: "overwrite" });
  }

  async deleteByNodeIds(nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) {
      return;
    }

    const table = await this.getTable();
    if (!table) {
      return;
    }

    if (nodeIds.length >= 100) {
      // For large deletes, use native delete — much faster than reading all rows
      const filter = createNodeIdFilter(nodeIds);
      await table.delete(filter);
      return;
    }

    // For small deletes, still use native delete
    const filter = createNodeIdFilter(nodeIds);
    await table.delete(filter);
  }

  async upsert(records: IndexedNodeDocument[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const table = await this.getTable();
    if (!table) {
      await this.reset(records);
      return;
    }

    // Delete existing rows for the nodeIds we're updating, then add new records
    const nodeIds = records.map((record) => record.nodeId);
    const filter = createNodeIdFilter(nodeIds);
    await table.delete(filter);
    await table.add(records.map(toRow));
  }

  async search(queryVector: number[], limit: number): Promise<IndexedNodeDocument[]> {
    const table = await this.getTable();
    if (!table) {
      return [];
    }

    const rows = await table.vectorSearch(Float32Array.from(queryVector)).limit(limit).toArray();
    return rows.map((row) => fromRow(row as Record<string, unknown>));
  }

  async get(nodeId: string): Promise<IndexedNodeDocument | null> {
    const results = await this.getMany([nodeId]);
    return results[0] ?? null;
  }

  async getMany(nodeIds: string[]): Promise<IndexedNodeDocument[]> {
    if (nodeIds.length === 0) {
      return [];
    }

    const table = await this.getTable();
    if (!table) {
      return [];
    }

    const rows = await table.query().where(createNodeIdFilter(nodeIds)).toArray();
    const rowsByNodeId = new Map(
      rows.map((row) => fromRow(row as Record<string, unknown>)).map((row) => [row.nodeId, row])
    );

    return nodeIds
      .map((nodeId) => rowsByNodeId.get(nodeId))
      .filter((row): row is IndexedNodeDocument => Boolean(row));
  }

  async close(): Promise<void> {
    const table = await this.getTable();
    if (table?.close) {
      await table.close();
    }
  }

  private getMetadataPath(): string {
    return path.join(this.dbPath, METADATA_FILE);
  }

  async getMetadata<T>(): Promise<T | null> {
    const metadataPath = this.getMetadataPath();
    if (!(await fileExists(metadataPath))) {
      return null;
    }
    try {
      return await readJson<T>(metadataPath);
    } catch (error) {
      throw new IndexingError("Failed to read vector store metadata.", { metadataPath }, { cause: error });
    }
  }

  async setMetadata<T>(metadata: T): Promise<void> {
    const metadataPath = this.getMetadataPath();
    await writeJson(metadataPath, metadata);
  }

  async clear(): Promise<void> {
    const table = await this.getTable();
    if (table) {
      await table.delete(DELETE_ALL_FILTER);
    }
    const metadataPath = this.getMetadataPath();
    if (await fileExists(metadataPath)) {
      await fs.unlink(metadataPath);
    }
  }
}
