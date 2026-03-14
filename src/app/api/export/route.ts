import { NextResponse } from "next/server";

import { createExecutionReport } from "@/lib/blueprint/execute";
import { exportBlueprintArtifacts } from "@/lib/blueprint/export";
import { exportBlueprintRequestSchema } from "@/lib/blueprint/schema";
import { createRunPlan } from "@/lib/blueprint/plan";
import { assessExportRisk } from "@/lib/blueprint/risk";
import { createSandboxDir, syncSandboxToTarget, writeDiffManifest } from "@/lib/blueprint/sandbox";
import {
  createApprovalRecord,
  createCheckpointIfNeeded,
  createRunId,
  getApprovalRecord,
  saveRunRecord,
  upsertSession
} from "@/lib/blueprint/store";

export async function POST(request: Request) {
  try {
    const payload = exportBlueprintRequestSchema.parse(await request.json());
    const runPlan = createRunPlan(payload.graph);
    const assessment = await assessExportRisk(payload.graph, runPlan, payload.outputDir);
    const runId = createRunId();

    if (assessment.riskReport.requiresApproval) {
      if (!payload.approvalId) {
        const approval = await createApprovalRecord({
          projectName: payload.graph.projectName,
          fingerprint: assessment.fingerprint,
          outputDir: assessment.outputDir,
          runPlan,
          riskReport: assessment.riskReport
        });

        const session = await upsertSession({
          graph: payload.graph,
          runPlan,
          lastRiskReport: assessment.riskReport,
          approvalId: approval.id
        });

        await saveRunRecord({
          id: runId,
          projectName: payload.graph.projectName,
          action: "export",
          createdAt: new Date().toISOString(),
          runPlan,
          riskReport: assessment.riskReport,
          approvalId: approval.id
        });

        return NextResponse.json({
          requiresApproval: true,
          approval,
          riskReport: assessment.riskReport,
          runPlan,
          session
        });
      }

      const approval = await getApprovalRecord(payload.approvalId);
      if (!approval) {
        throw new Error(`Approval ${payload.approvalId} was not found.`);
      }

      if (approval.status !== "approved") {
        throw new Error(`Approval ${payload.approvalId} is not approved yet.`);
      }

      if (approval.fingerprint !== assessment.fingerprint) {
        throw new Error("Approval does not match the current export request.");
      }
    }

    const checkpointDir = await createCheckpointIfNeeded(assessment.outputDir, runId);
    const executionReport = createExecutionReport(payload.graph, runPlan);
    const result =
      payload.graph.mode === "yolo"
        ? await (async () => {
            const sandboxDir = await createSandboxDir(runId);
            const sandboxResult = await exportBlueprintArtifacts(
              payload.graph,
              sandboxDir,
              executionReport,
              payload.codeDrafts
            );
            const diffPath = await writeDiffManifest({
              sandboxResult,
              targetDir: assessment.outputDir
            });
            await syncSandboxToTarget({
              sandboxDir: sandboxResult.rootDir,
              targetDir: assessment.outputDir
            });

            return {
              ...sandboxResult,
              rootDir: assessment.outputDir,
              sandboxDir: sandboxResult.rootDir,
              diffPath
            };
          })()
        : await exportBlueprintArtifacts(
            payload.graph,
            assessment.outputDir,
            executionReport,
            payload.codeDrafts
          );
    const finalResult = checkpointDir ? { ...result, checkpointDir } : result;
    const session = await upsertSession({
      graph: payload.graph,
      runPlan,
      lastRiskReport: assessment.riskReport,
      lastExportResult: finalResult,
      lastExecutionReport: executionReport
    });

    await saveRunRecord({
      id: runId,
      projectName: payload.graph.projectName,
      action: "export",
      createdAt: new Date().toISOString(),
      runPlan,
      riskReport: assessment.riskReport,
      approvalId: payload.approvalId,
      executionReport,
      exportResult: finalResult
    });

    return NextResponse.json({
      result: finalResult,
      executionReport,
      riskReport: assessment.riskReport,
      runPlan,
      session
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to export blueprint artifacts."
      },
      { status: 400 }
    );
  }
}
