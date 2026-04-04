import { NextResponse } from "next/server";
import { z } from "zod";

import {
  TERMINAL_REPO_PATH_HEADER,
  createTerminalSession,
  listTerminalSessions
} from "@/lib/server/terminal-sessions";

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(80).optional()
});

export async function GET() {
  return NextResponse.json({
    sessions: listTerminalSessions()
  });
}

export async function POST(request: Request) {
  try {
    const payload = createSessionSchema.parse(
      await request
        .json()
        .catch(() => ({}))
    );
    const repoPath = request.headers.get(TERMINAL_REPO_PATH_HEADER) ?? undefined;
    const session = await createTerminalSession({
      cwd: repoPath,
      title: payload.title
    });

    return NextResponse.json(
      { session },
      { status: 201 }
    );
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Failed to create terminal session.";
    return NextResponse.json({ error: message }, { status });
  }
}
