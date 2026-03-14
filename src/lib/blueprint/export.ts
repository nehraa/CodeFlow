import fs from "node:fs/promises";
import path from "node:path";

import type {
  BlueprintGraph,
  BlueprintNode,
  ContractField,
  ExecutionReport,
  ExportResult
} from "@/lib/blueprint/schema";
import { generateNodeCode, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
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
  const stubLink =
    node.kind === "module" ? "N/A" : `stubs/${slugify(node.kind)}-${slugify(node.name)}.${node.kind === "ui-screen" ? "tsx" : "ts"}`;

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

  await ensureDir(docsDir);
  await ensureDir(stubsDir);

  await fs.writeFile(blueprintPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  await fs.writeFile(canvasPath, `${JSON.stringify(buildCanvas(graph), null, 2)}\n`, "utf8");
  await fs.writeFile(phaseManifestPath, `${JSON.stringify(buildPhaseManifest(graph), null, 2)}\n`, "utf8");

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
  await fs.writeFile(
    obsidianIndexPath,
    `# ${graph.projectName} Vault Index

## Core Links
- [[docs/index]]
- [[system.canvas]]

## Nodes
${graph.nodes.map((node) => `- [[docs/${slugify(node.kind)}-${slugify(node.name)}]]`).join("\n")}
`,
    "utf8"
  );

  for (const node of graph.nodes) {
    const docPath = path.join(docsDir, `${slugify(node.kind)}-${slugify(node.name)}.md`);
    await fs.writeFile(docPath, buildNodeDoc(node), "utf8");

    if (!isCodeBearingNode(node)) {
      continue;
    }

    const stubContent = codeDrafts?.[node.id] ?? node.implementationDraft ?? node.specDraft ?? generateNodeCode(node, graph);
    if (!stubContent) {
      continue;
    }

    const extension = node.kind === "ui-screen" ? "tsx" : "ts";
    const stubPath = path.join(stubsDir, `${slugify(node.kind)}-${slugify(node.name)}.${extension}`);
    await fs.writeFile(stubPath, stubContent, "utf8");
  }

  if (executionReport) {
    await fs.writeFile(ownershipPath, `${JSON.stringify(executionReport.ownership, null, 2)}\n`, "utf8");
  }

  const integrationEntrypoint = buildIntegrationEntrypoint(graph);
  if (integrationEntrypoint) {
    await fs.writeFile(integrationEntrypointPath, integrationEntrypoint, "utf8");
  }

  return {
    rootDir: baseDir,
    blueprintPath,
    canvasPath,
    docsDir,
    stubsDir,
    phaseManifestPath,
    integrationEntrypointPath: integrationEntrypoint ? integrationEntrypointPath : undefined,
    ownershipPath: executionReport ? ownershipPath : undefined,
    obsidianIndexPath
  };
};
