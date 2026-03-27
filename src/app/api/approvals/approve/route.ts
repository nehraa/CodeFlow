import { NextResponse } from "next/server";

import { approveRecord } from "@/lib/blueprint/approval-store";
import { approvalActionRequestSchema } from "@/lib/blueprint/schema";

export async function POST(request: Request) {
  try {
    const payload = approvalActionRequestSchema.parse(await request.json());
    const approval = await approveRecord(payload.approvalId);

    return NextResponse.json({ approval });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to approve pending action."
      },
      { status: 400 }
    );
  }
}
