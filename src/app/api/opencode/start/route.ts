import { NextResponse } from "next/server";
import { z } from "zod";
import { startOpencodeServer } from "@/lib/opencode/server";
import { buildOpencodeConfig } from "@/lib/opencode/config";
import type { OpencodeProvider } from "@/lib/opencode/types";

const startRequestSchema = z.object({
  provider: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = startRequestSchema.parse(body);
    
    const config = buildOpencodeConfig(
      validated.provider as OpencodeProvider,
      validated.apiKey,
      {
        model: validated.model,
        baseUrl: validated.baseUrl,
        logLevel: validated.logLevel,
      }
    );
    
    const info = await startOpencodeServer(config);
    return NextResponse.json(info);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start server" },
      { status: 500 }
    );
  }
}
