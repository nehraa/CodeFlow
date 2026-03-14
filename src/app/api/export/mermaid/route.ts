import { NextResponse } from "next/server";
import { z } from "zod";

import { toMermaid, toMermaidClassDiagram } from "@/lib/blueprint/mermaid";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

const mermaidExportRequestSchema = z.object({
  graph: blueprintGraphSchema,
  format: z.enum(["flowchart", "class-diagram"]).default("flowchart")
});

export async function POST(request: Request) {
  try {
    const payload = mermaidExportRequestSchema.parse(await request.json());
    const diagram =
      payload.format === "class-diagram"
        ? toMermaidClassDiagram(payload.graph)
        : toMermaid(payload.graph);

    return NextResponse.json({ diagram, format: payload.format });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate Mermaid diagram."
      },
      { status: 400 }
    );
  }
}
