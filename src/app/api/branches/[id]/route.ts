import { NextResponse } from "next/server";

import { deleteBranch, loadBranch } from "@/lib/blueprint/store";

function isValidBranchId(id: string): boolean {
  // Allow only simple, safe identifiers (no path separators or traversal characters)
  return /^[A-Za-z0-9_-]+$/.test(id);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");
    const { id } = params;

    if (!projectName) {
      return NextResponse.json({ error: "projectName query param is required." }, { status: 400 });
    }

    if (!id || !isValidBranchId(id)) {
      return NextResponse.json({ error: "Invalid branch id." }, { status: 400 });
    }

    const branch = await loadBranch(projectName, id);
    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    return NextResponse.json({ branch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load branch." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");
    const { id } = params;

    if (!projectName) {
      return NextResponse.json({ error: "projectName query param is required." }, { status: 400 });
    }

    if (!id || !isValidBranchId(id)) {
      return NextResponse.json({ error: "Invalid branch id." }, { status: 400 });
    }

    await deleteBranch(projectName, id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete branch." },
      { status: 500 }
    );
  }
}
