import { NextResponse } from "next/server";

import { z } from "zod";

import { createBranch } from "@/lib/blueprint/branches";
import { loadBranches, saveBranch } from "@/lib/blueprint/branch-store";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

const createBranchRequestSchema = z.object({
  graph: blueprintGraphSchema,
  name: z.string().trim().min(1),
  description: z.string().optional(),
  parentBranchId: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");

    if (!projectName) {
      return NextResponse.json({ error: "projectName query param is required." }, { status: 400 });
    }

    const branches = await loadBranches(projectName);
    return NextResponse.json({ branches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list branches." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = createBranchRequestSchema.parse(await request.json());
    const branch = createBranch({
      graph: payload.graph,
      name: payload.name,
      description: payload.description,
      parentBranchId: payload.parentBranchId
    });

    await saveBranch(branch);

    return NextResponse.json({ branch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create branch." },
      { status: 400 }
    );
  }
}
