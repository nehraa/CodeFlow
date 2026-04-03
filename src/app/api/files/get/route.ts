import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

const getFileRequestSchema = z.object({
  path: z.string().min(1)
});

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

export async function POST(request: Request) {
  try {
    const payload = getFileRequestSchema.parse(await request.json());
    const rootDir = process.cwd();
    const filePath = path.resolve(rootDir, payload.path);

    const rel = path.relative(rootDir, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return NextResponse.json(
        { error: "Access to the requested path is not allowed" },
        { status: 400 }
      );
    }

    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is a directory, not a file" },
        { status: 400 }
      );
    }

    if (fileStat.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large to read" },
        { status: 400 }
      );
    }

    const content = await readFile(filePath, "utf-8");

    return NextResponse.json({ content, path: rel });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return NextResponse.json(
          { error: "File not found" },
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

    const message = error instanceof Error ? error.message : "Failed to read file";
    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
