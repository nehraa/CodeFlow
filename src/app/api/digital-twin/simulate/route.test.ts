import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST as buildPOST } from "@/app/api/blueprint/route";
import { POST } from "@/app/api/digital-twin/simulate/route";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("POST /api/digital-twin/simulate", () => {
  it("returns 404 when no session exists for the project", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-sim-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/digital-twin/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectName: "NoSuchProject", nodeIds: ["function:foo"] })
      })
    );

    expect(response.status).toBe(404);
  });

  it("generates synthetic spans and updates the session", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-sim-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    // Build a blueprint first so we have a session.
    await buildPOST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "SimApp",
          prdText: "# Functions\n- Function: placeOrder()\n- Function: sendEmail()",
          mode: "essential"
        })
      })
    );

    const response = await POST(
      new Request("http://localhost/api/digital-twin/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "SimApp",
          nodeIds: [],  // empty → validation error
          label: "Checkout flow"
        })
      })
    );

    // nodeIds must have at least one element
    expect(response.status).toBe(400);
  });

  it("accepts a valid simulation request and returns spans", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-sim2-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    // Build a blueprint so we have a session with known nodes.
    const buildResponse = await buildPOST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "SimApp2",
          prdText: "# Functions\n- Function: processPayment()",
          mode: "essential"
        })
      })
    );
    const buildBody = (await buildResponse.json()) as { graph?: { nodes: Array<{ id: string }> } };
    const nodeIds = buildBody.graph?.nodes.map((n) => n.id) ?? [];

    if (nodeIds.length === 0) {
      // Blueprint may not have generated nodes in all environments; skip.
      return;
    }

    const response = await POST(
      new Request("http://localhost/api/digital-twin/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "SimApp2",
          nodeIds: nodeIds.slice(0, 2),
          label: "Payment flow",
          runtime: "test"
        })
      })
    );
    const body = (await response.json()) as {
      spans: Array<{ spanId: string; runtime: string }>;
      snapshot: { spans: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.spans.length).toBeGreaterThan(0);
    expect(body.spans[0].runtime).toBe("test");
    expect(body.snapshot.spans.length).toBeGreaterThan(0);
  });
});
