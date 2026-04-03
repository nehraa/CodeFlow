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
    const rootDir = process.cwd();
    const dirPath = path.resolve(rootDir, payload.path);

    const rel = path.relative(rootDir, dirPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return NextResponse.json(
        { error: "Access to the requested path is not allowed" },
        { status: 400 }
      );
    }

    let dirStat;
    try {
      dirStat = await stat(dirPath);
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return NextResponse.json(
            { error: "Directory not found" },
            { status: 404 }
          );
        }
        if (code === "EACCES") {
          return NextResponse.json(
            { error: "Permission denied" },
            { status: 403 }
          );
        }
      }
      throw error;
    }

    if (!dirStat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const entries = await readdir(dirPath, { withFileTypes: true });

    const entryResults = await Promise.all(
      entries.map(async (entry) => {
        const isDirectory = entry.isDirectory();

        if (!isDirectory && !hasAllowedExtension(entry.name)) {
          return null;
        }

        const entryPath = path.join(dirPath, entry.name);

        return {
          path: path.relative(rootDir, entryPath),
          name: entry.name,
          isDirectory
        };
      })
    );

    const fileEntries: FileEntry[] = entryResults.filter((entry): entry is FileEntry => entry !== null);

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
