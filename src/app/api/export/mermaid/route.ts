import { NextResponse } from "next/server";
import { z } from "zod";

import { toMermaid, toMermaidClassDiagram } from "@abhinav2203/codeflow-execution/mermaid";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

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