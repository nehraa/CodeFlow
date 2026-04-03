import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import {
  validateFilePath,
  FileSecurityError,
  ensureFileIsWithinRepo,
} from "@/lib/file-security";

const REPO_ROOT = process.env.CODEFLOW_REPO_ROOT ?? process.cwd();

const fileWriteSchema = z.object({
  path: z.string().min(1, "Path is required"),
  content: z.string(),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8"),
});

interface FileWriteSuccessResponse {
  path: string;
  size: number;
  created: boolean;
  updatedAt: string;
}

interface FileErrorResponse {
  error: string;
  code: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<FileErrorResponse>(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = fileWriteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json<FileErrorResponse>(
        {
          error: parseResult.error.issues.map((e) => e.message).join(", "),
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { path: filePathParam, content, encoding } = parseResult.data;

    let validatedPath: string;
    try {
      validatedPath = validateFilePath(filePathParam, REPO_ROOT);
    } catch (error) {
      if (error instanceof FileSecurityError) {
        return NextResponse.json<FileErrorResponse>(
          { error: error.message, code: error.code },
          { status: 403 }
        );
      }
      throw error;
    }

    const dirPath = path.dirname(validatedPath);

    // Create parent directories first so that realpath() can resolve the
    // directory when ensureFileIsWithinRepo() performs its symlink check.
    await fs.mkdir(dirPath, { recursive: true });

    // Defense-in-depth: verify the created directory resolves within the repo
    // root after symlink resolution.
    const dirWithinRepo = await ensureFileIsWithinRepo(dirPath, REPO_ROOT);
    if (!dirWithinRepo) {
      return NextResponse.json<FileErrorResponse>(
        { error: "Path escapes repository root", code: "PATH_ESCAPE" },
        { status: 403 }
      );
    }

    // Check file existence (F_OK) before writing so we can report whether
    // this is a create or update.  R_OK would give a false negative for
    // files that exist but are not readable.
    let existed = false;
    try {
      await fs.access(validatedPath, fs.constants.F_OK);
      existed = true;
    } catch {
      // File does not exist – this is a create operation.
    }

    const fileData =
      encoding === "base64" ? Buffer.from(content, "base64") : content;

    if (typeof fileData === "string") {
      await fs.writeFile(validatedPath, fileData, "utf-8");
    } else {
      await fs.writeFile(validatedPath, fileData);
    }

    const stats = await fs.stat(validatedPath);

    return NextResponse.json<FileWriteSuccessResponse>({
      path: filePathParam,
      size: stats.size,
      created: !existed,
      updatedAt: stats.mtime.toISOString(),
    });
  } catch (error) {
    console.error("File write error:", error);

    return NextResponse.json<FileErrorResponse>(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}