import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import {
  validateFilePath,
  FileSecurityError,
  STREAM_THRESHOLD_BYTES,
  fileExists,
} from "@/lib/file-security";

const DEFAULT_REPO_ROOT = process.env.CODEFLOW_REPO_ROOT ?? process.cwd();
const REPO_PATH_HEADER = "x-codeflow-repo-path";

interface FileErrorResponse {
  error: string;
  code: string;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const filePathParam = url.searchParams.get("path");
    const repoPathHeader = request.headers.get(REPO_PATH_HEADER);
    const repoRoot = repoPathHeader || DEFAULT_REPO_ROOT;

    if (!filePathParam) {
      return NextResponse.json<FileErrorResponse>(
        { error: "Missing path parameter", code: "MISSING_PATH" },
        { status: 400 }
      );
    }

    let validatedPath: string;
    try {
      validatedPath = validateFilePath(filePathParam, repoRoot);
    } catch (error) {
      if (error instanceof FileSecurityError) {
        return NextResponse.json<FileErrorResponse>(
          { error: error.message, code: error.code },
          { status: 403 }
        );
      }
      throw error;
    }

    if (!(await fileExists(validatedPath))) {
      return NextResponse.json<FileErrorResponse>(
        { error: "File not found", code: "FILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const stats = await fs.promises.stat(validatedPath);

    if (stats.isDirectory()) {
      return NextResponse.json<FileErrorResponse>(
        { error: "Path is a directory", code: "IS_DIRECTORY" },
        { status: 400 }
      );
    }

    const fileSize = stats.size;
    const fileName = path.basename(validatedPath);

    if (fileSize > STREAM_THRESHOLD_BYTES) {
      const stream = createReadStream(validatedPath);

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    }

    const content = await fs.promises.readFile(validatedPath, "utf-8");

    return NextResponse.json({
      path: filePathParam,
      content,
      size: fileSize,
    });
  } catch (error) {
    console.error("File read error:", error);

    return NextResponse.json<FileErrorResponse>(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}