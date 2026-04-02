import fs from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactValidationState,
  BlueprintGraph,
  BlueprintNode,
  ContractField,
  ExecutionReport,
  ExportArtifact,
  ExportResult
} from "@/lib/blueprint/schema";
import { generateNodeCode, getNodeDocPath, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import { createRunPlan } from "@/lib/blueprint/plan";
import { getCodeBearingNodes, getDefaultExecutionTarget } from "@/lib/blueprint/phases";
import { slugify } from "@/lib/blueprint/utils";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const formatField = (field: ContractField): string =>
  `${field.name}: ${field.type}${field.description ? ` - ${field.description}` : ""}`;

const formatList = (items: string[]): string => (items.length ? items.map((item) => `- ${item}`).join("\n") : "- None");

const formatFields = (fields: ContractField[]): string =>
  fields.length ? fields.map((field) => `- ${formatField(field)}`).join("\n") : "- None";

const layoutNodesForCanvas = (graph: BlueprintGraph) =>
  graph.nodes.map((node, index) => ({
    id: node.id,
    type: "text",
    x: 80 + (index % 3) * 380,
    y: 80 + Math.floor(index / 3) * 220,
    width: 300,
    height: 140,
    text: `# ${node.name}\n\nKind: ${node.kind}\n${node.summary}`
  }));

const buildCanvas = (graph: BlueprintGraph) => ({
  nodes: layoutNodesForCanvas(graph),
  edges: graph.edges.map((edge) => ({
    id: `${edge.kind}:${edge.from}:${edge.to}`,
    fromNode: edge.from,
    fromSide: "right",
    toNode: edge.to,
    toSide: "left",
    label: edge.label ?? edge.kind
  }))
});

const buildNodeDoc = (node: BlueprintNode): string => {
  const inputs = formatFields(node.contract.inputs);
  const outputs = formatFields(node.contract.outputs);
  const responsibilities = formatList(node.contract.responsibilities);
  const attributes = formatFields(node.contract.attributes);
  const dependencies = formatList(node.contract.dependencies);
  const sideEffects = formatList(node.contract.sideEffects);
  const errors = formatList(node.contract.errors);
  const calls = node.contract.calls.length
    ? node.contract.calls
        .map((call) => `- ${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`)
        .join("\n")
    : "- None";
  const methods = node.contract.methods.length
    ? node.contract.methods
        .map((method) => {
          const methodCalls = method.calls.length
            ? method.calls
                .map((call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`)
                .join("; ")
            : "None";

          return [
            `- ${method.name}`,
            `  Signature: ${method.signature ?? "N/A"}`,
            `  Summary: ${method.summary}`,
            `  Inputs: ${method.inputs.length ? method.inputs.map(formatField).join("; ") : "None"}`,
            `  Outputs: ${method.outputs.length ? method.outputs.map(formatField).join("; ") : "None"}`,
            `  Side effects: ${method.sideEffects.length ? method.sideEffects.join("; ") : "None"}`,
            `  Calls: ${methodCalls}`
          ].join("\n");
        })
        .join("\n")
    : "- None";
  const notes = formatList(node.contract.notes);
  const stubLink = getNodeStubPath(node) ?? "N/A";

  return `# ${node.name}

Kind: ${node.kind}

Summary:
${node.summary}

Responsibilities:
${responsibilities}

Signature:
${node.signature ?? "N/A"}

Inputs:
${inputs}

Outputs:
${outputs}

Attributes / State:
${attributes}

Methods:
${methods}

Dependencies:
${dependencies}

Calls:
${calls}

Side effects:
${sideEffects}

Errors:
${errors}

Notes:
${notes}

Obsidian:
- [[index]]
- Stub path: ${stubLink}
- Phase status: ${node.status ?? "spec_only"}
`;
};

const buildPhaseManifest = (graph: BlueprintGraph) => ({
  phase: graph.phase ?? "spec",
  exportedAt: new Date().toISOString(),
  nodes: graph.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    kind: node.kind,
    status: node.status ?? "spec_only",
    specPath: getNodeStubPath(node),
    hasSpecDraft: Boolean(node.specDraft),
    hasImplementationDraft: Boolean(node.implementationDraft),
    hasVerification: Boolean(node.lastVerification)
  }))
});

const buildIntegrationEntrypoint = (graph: BlueprintGraph): string | null => {
  if (graph.phase !== "integration") {
    return null;
  }

  const targetNode = getDefaultExecutionTarget(graph);
  const targetPath = targetNode ? getNodeStubPath(targetNode) : null;
  if (!targetNode || !targetPath) {
    return null;
  }

  const rootExport = targetNode.kind === "ui-screen" ? "default" : undefined;
  const codeBearingImports = getCodeBearingNodes(graph)
    .map((node, index) => {
      const stubPath = getNodeStubPath(node);
      if (!stubPath) {
        return null;
      }

      return {
        binding: node.id === targetNode.id ? "integrationRoot" : `integrationNode${index + 1}`,
        importPath: `./${stubPath.replace(/\.(ts|tsx)$/, "")}`
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const rootNamedExport =
    rootExport ??
    targetNode.name
      .split(".")
      .pop()
      ?.replace(/[^A-Za-z0-9_$]+/g, " ")
      .trim()
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (chunk, index) => (index === 0 ? chunk.toLowerCase() : chunk.toUpperCase()))
      .replace(/\s+/g, "");

  if (!rootNamedExport) {
    return null;
  }

  return [
    `import * as integrationRoot from "${codeBearingImports.find((entry) => entry.binding === "integrationRoot")?.importPath ?? `./${targetPath.replace(/\.(ts|tsx)$/, "")}`}";`,
    ...codeBearingImports
      .filter((entry) => entry.binding !== "integrationRoot")
      .map((entry) => `import * as ${entry.binding} from "${entry.importPath}";\nvoid ${entry.binding};`),
    "",
    "export async function runIntegration(input: unknown) {",
    `  const runner = integrationRoot["${rootNamedExport}"] as ((...args: any[]) => any) | undefined;`,
    '  if (typeof runner !== "function") {',
    '    throw new Error("Integration root export is not callable.");',
    "  }",
    "  const args = Array.isArray(input) ? input : [input];",
    "  return runner(...args);",
    "}"
  ].join("\n");
};

const classifyNodeArtifact = (
  node: BlueprintNode,
  graph: BlueprintGraph,
  draftOverride?: string
): {
  content: string | null;
  validationState: ArtifactValidationState;
  maturity: "production" | "preview" | "scaffold";
  provenance: "deterministic";
  notes: string[];
} => {
  if (draftOverride) {
    const isValidated = node.lastVerification?.status === "success";
    return {
      content: draftOverride,
      validationState: isValidated ? "validated" : "draft",
      maturity: isValidated ? "production" : "preview",
      provenance: "deterministic",
      notes: ["Using the current editor draft captured at export time."]
    };
  }

  if (node.implementationDraft) {
    const isValidated = node.lastVerification?.status === "success";
    return {
      content: node.implementationDraft,
      validationState: isValidated ? "validated" : "draft",
      maturity: isValidated ? "production" : "preview",
      provenance: "deterministic",
      notes: ["Using the node implementation draft stored in the blueprint."]
    };
  }

  if (node.specDraft) {
    return {
      content: node.specDraft,
      validationState: "draft",
      maturity: "preview",
      provenance: "deterministic",
      notes: ["Using the node specification draft because no implementation draft exists."]
    };
  }

  return {
    content: generateNodeCode(node, graph),
    validationState: "scaffold",
    maturity: "scaffold",
    provenance: "deterministic",
    notes: ["Generated deterministic scaffold content from the blueprint contract."]
  };
};

export const exportBlueprintArtifacts = async (
  graph: BlueprintGraph,
  outputDir?: string,
  executionReport?: ExecutionReport,
  codeDrafts?: Record<string, string>
): Promise<ExportResult> => {
  const runPlan = createRunPlan(graph);
  const baseDir =
    outputDir && outputDir.trim()
      ? path.resolve(outputDir)
      : path.resolve(process.cwd(), "artifacts", slugify(graph.projectName));
  const docsDir = path.join(baseDir, "docs");
  const stubsDir = path.join(baseDir, "stubs");
  const blueprintPath = path.join(baseDir, "blueprint.json");
  const canvasPath = path.join(baseDir, "system.canvas");
  const ownershipPath = path.join(baseDir, "ownership.json");
  const obsidianIndexPath = path.join(baseDir, "obsidian-index.md");
  const phaseManifestPath = path.join(baseDir, "phase-manifest.json");
  const integrationEntrypointPath = path.join(baseDir, "integration-entrypoint.ts");
  const artifactManifestPath = path.join(baseDir, "artifact-manifest.json");
  const exportedAt = new Date().toISOString();
  const artifacts: ExportArtifact[] = [];

  await ensureDir(docsDir);
  await ensureDir(stubsDir);

  await fs.writeFile(blueprintPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  await fs.writeFile(canvasPath, `${JSON.stringify(buildCanvas(graph), null, 2)}\n`, "utf8");
  await fs.writeFile(phaseManifestPath, `${JSON.stringify(buildPhaseManifest(graph), null, 2)}\n`, "utf8");
  artifacts.push({
    relativePath: path.relative(baseDir, blueprintPath),
    artifactType: "blueprint",
    validationState: "validated",
    provenance: "deterministic",
    maturity: "production",
    generatedAt: exportedAt,
    notes: ["Serialized blueprint graph."]
  });
  artifacts.push({
    relativePath: path.relative(baseDir, canvasPath),
    artifactType: "canvas",
    validationState: "validated",
    provenance: "deterministic",
    maturity: "production",
    generatedAt: exportedAt,
    notes: ["Canvas projection of the blueprint graph."]
  });

  const summaryDoc = `# ${graph.projectName}

Generated at: ${graph.generatedAt}
Mode: ${graph.mode}
Current phase: ${graph.phase ?? "spec"}

Nodes:
${graph.nodes.map((node) => `- ${node.kind}: ${node.name}`).join("\n")}

Workflows:
${graph.workflows.length ? graph.workflows.map((workflow) => `- ${workflow.name}: ${workflow.steps.join(" -> ")}`).join("\n") : "- None"}

Execution phases:
${
  runPlan.batches.length
    ? runPlan.batches
        .map((batch) => {
          const taskTitles = batch.taskIds
            .map((taskId) => runPlan.tasks.find((task) => task.id === taskId)?.title)
            .filter(Boolean)
            .join("; ");

          return `- Phase ${batch.index + 1}: ${taskTitles || "No tasks"}`;
        })
        .join("\n")
    : "- None"
}
`;
  await fs.writeFile(path.join(docsDir, "index.md"), summaryDoc, "utf8");
  artifacts.push({
    relativePath: path.relative(baseDir, path.join(docsDir, "index.md")),
    artifactType: "documentation",
    validationState: "validated",
    provenance: "deterministic",
    maturity: "production",
    generatedAt: exportedAt,
    notes: ["Top-level export summary."]
  });
  await fs.writeFile(
    obsidianIndexPath,
    `# ${graph.projectName} Vault Index

## Core Links
- [[docs/index]]
- [[system.canvas]]

## Nodes
${graph.nodes.map((node) => `- [[${getNodeDocPath(node).replace(/\.md$/, "")}]]`).join("\n")}
`,
    "utf8"
  );
  artifacts.push({
    relativePath: path.relative(baseDir, obsidianIndexPath),
    artifactType: "documentation",
    validationState: "validated",
    provenance: "deterministic",
    maturity: "production",
    generatedAt: exportedAt,
    notes: ["Obsidian index for exported documentation."]
  });

  for (const node of graph.nodes) {
    const docPath = path.join(baseDir, getNodeDocPath(node));
    await fs.writeFile(docPath, buildNodeDoc(node), "utf8");
    artifacts.push({
      nodeId: node.id,
      nodeName: node.name,
      nodeKind: node.kind,
      relativePath: path.relative(baseDir, docPath),
      artifactType: "documentation",
      validationState: "validated",
      provenance: "deterministic",
      maturity: "production",
      generatedAt: exportedAt,
      notes: ["Per-node architecture documentation."]
    });

    if (!isCodeBearingNode(node)) {
      continue;
    }

    const artifact = classifyNodeArtifact(node, graph, codeDrafts?.[node.id]);
    const stubContent = artifact.content;
    if (!stubContent) {
      continue;
    }

    const extension = node.kind === "ui-screen" ? "tsx" : "ts";
    const stubPath = path.join(stubsDir, `${slugify(node.kind)}-${slugify(node.name)}.${extension}`);
    await fs.writeFile(stubPath, stubContent, "utf8");
    artifacts.push({
      nodeId: node.id,
      nodeName: node.name,
      nodeKind: node.kind,
      relativePath: path.relative(baseDir, stubPath),
      artifactType: "code",
      validationState: artifact.validationState,
      provenance: artifact.provenance,
      maturity: artifact.maturity,
      generatedAt: exportedAt,
      notes: artifact.notes
    });
  }

  if (executionReport) {
    await fs.writeFile(ownershipPath, `${JSON.stringify(executionReport.ownership, null, 2)}\n`, "utf8");
    artifacts.push({
      relativePath: path.relative(baseDir, ownershipPath),
      artifactType: "ownership",
      validationState: "validated",
      provenance: "deterministic",
      maturity: "production",
      generatedAt: exportedAt,
      notes: ["Ownership records for managed regions."]
    });
  }

  const integrationEntrypoint = buildIntegrationEntrypoint(graph);
  if (integrationEntrypoint) {
    await fs.writeFile(integrationEntrypointPath, integrationEntrypoint, "utf8");
    artifacts.push({
      relativePath: path.relative(baseDir, integrationEntrypointPath),
      artifactType: "integration",
      validationState: "draft",
      provenance: "deterministic",
      maturity: "preview",
      generatedAt: exportedAt,
      notes: ["Generated integration runner entrypoint."]
    });
  }

  await fs.writeFile(artifactManifestPath, `${JSON.stringify({ exportedAt, artifacts }, null, 2)}\n`, "utf8");

  const artifactSummary = artifacts.reduce(
    (summary, artifact) => {
      summary.total += 1;
      if (artifact.validationState === "validated") {
        summary.validated += 1;
      } else if (artifact.validationState === "draft") {
        summary.draft += 1;
      } else {
        summary.scaffold += 1;
      }
      return summary;
    },
    { total: 0, validated: 0, draft: 0, scaffold: 0 }
  );

  return {
    rootDir: baseDir,
    blueprintPath,
    canvasPath,
    docsDir,
    stubsDir,
    artifactManifestPath,
    artifactSummary,
    phaseManifestPath,
    integrationEntrypointPath: integrationEntrypoint ? integrationEntrypointPath : undefined,
    ownershipPath: executionReport ? ownershipPath : undefined,
    obsidianIndexPath
  };
};
