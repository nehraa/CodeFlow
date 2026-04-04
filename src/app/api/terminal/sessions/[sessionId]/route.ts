import { NextResponse } from "next/server";
import { z } from "zod";

import {
  closeTerminalSession,
  getTerminalSession,
  writeTerminalInput
} from "@/lib/server/terminal-sessions";

const terminalInputSchema = z.object({
  input: z.string().min(1),
  echoInput: z.boolean().optional()
});

const isValidSessionId = (value: string): boolean => /^[A-Za-z0-9-]+$/.test(value);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid terminal session id." }, { status: 400 });
  }

  const session = getTerminalSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Terminal session not found." }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ error: "Invalid terminal session id." }, { status: 400 });
    }

    const payload = terminalInputSchema.parse(await request.json());
    const session = await writeTerminalInput(sessionId, payload.input, {
      echoInput: payload.echoInput
    });

    return NextResponse.json({ session });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof Error && /not found/i.test(error.message)
          ? 404
          : 400;
    const message = error instanceof Error ? error.message : "Failed to write terminal input.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid terminal session id." }, { status: 400 });
  }

  const deleted = closeTerminalSession(sessionId);
  if (!deleted) {
    return NextResponse.json({ error: "Terminal session not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
