import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

const listFilesRequestSchema = z.object({
  path: z.string().min(1)
});

interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md"
]);

function hasAllowedExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export async function POST(request: Request) {
  try {
    const payload = listFilesRequestSchema.parse(await request.json());
    const dirPath = path.resolve(payload.path);

    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return NextResponse.json(
          { error: "Directory not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const fileEntries: FileEntry[] = [];

    for (const entryName of entries) {
      const entryPath = path.join(dirPath, entryName);

      try {
        const entryStat = await stat(entryPath);
        const isDirectory = entryStat.isDirectory();

        if (isDirectory || hasAllowedExtension(entryName)) {
          fileEntries.push({
            path: entryPath,
            name: entryName,
            isDirectory
          });
        }
      } catch {
        continue;
      }
    }

    fileEntries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(fileEntries);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
