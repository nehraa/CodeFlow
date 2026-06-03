import fs from "node:fs/promises";

type CacheEntry = {
  content: string;
  mtimeMs: number;
};

export class FileCache {
  private readonly cache = new Map<string, CacheEntry>();

  async read(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    const cached = this.cache.get(filePath);

    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.content;
    }

    const content = await fs.readFile(filePath, "utf8");
    this.cache.set(filePath, {
      content,
      mtimeMs: stats.mtimeMs
    });
    return content;
  }

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }
}
