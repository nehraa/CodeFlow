import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

const getFileRequestSchema = z.object({
  path: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const payload = getFileRequestSchema.parse(await request.json());
    const filePath = path.resolve(payload.path);

    const content = await readFile(filePath, "utf-8");

    return NextResponse.json({ content, path: filePath });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "ENOENT") {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }
      if (error.code === "EISDIR") {
        return NextResponse.json(
          { error: "Path is a directory, not a file" },
          { status: 400 }
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
