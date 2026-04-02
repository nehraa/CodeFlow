import type { BlueprintGraph, BlueprintNode, ContractField } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

export const isCodeBearingNode = (node: BlueprintNode): boolean => node.kind !== "module";

const normalizeContract = (contract: Partial<BlueprintNode["contract"]>) => ({
  ...emptyContract(),
  ...contract
});

const sanitizeIdentifier = (value: string): string => {
  const cleaned = value
    .replace(/[^A-Za-z0-9_$]+/g, " ")
    .trim()
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (chunk, index) =>
      index === 0 ? chunk.toLowerCase() : chunk.toUpperCase()
    )
    .replace(/\s+/g, "");

  return cleaned || "generatedNode";
};

const toPascalCase = (value: string): string => {
  const camel = sanitizeIdentifier(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

export const getNodeStubPath = (node: BlueprintNode): string | null => {
  if (!isCodeBearingNode(node)) {
    return null;
  }

  const extension = node.kind === "ui-screen" ? "tsx" : "ts";
  return `stubs/${node.kind.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${node.name
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase()}.${extension}`;
};

export const getNodeDocPath = (node: BlueprintNode): string => `docs/${node.id}.md`;

export const getNodeRuntimeExport = (node: BlueprintNode): string | null => {
  if (node.kind === "function" || node.kind === "api") {
    return sanitizeIdentifier(node.name.split(".").pop() ?? node.name);
  }

  if (node.kind === "class") {
    return toPascalCase(node.name);
  }

  return null;
};

const formatField = (field: ContractField): string =>
  `${field.name}: ${field.type}${field.description ? ` - ${field.description}` : ""}`;

const formatCommentSection = (title: string, lines: string[]): string[] =>
  lines.length ? [` * ${title}:`, ...lines.map((line) => ` * - ${line}`)] : [];

const buildDocComment = (node: BlueprintNode): string => {
  const contract = normalizeContract(node.contract);
  const lines = [
    "/**",
    ` * ${node.summary}`,
    " * @codeflowMaturity scaffold",
    " * @codeflowValidation scaffold",
    ...formatCommentSection("Responsibilities", contract.responsibilities),
    ...formatCommentSection("Inputs", contract.inputs.map(formatField)),
    ...formatCommentSection("Outputs", contract.outputs.map(formatField)),
    ...formatCommentSection(
      "Calls",
      contract.calls.map(
        (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
      )
    ),
    ...formatCommentSection("Errors", contract.errors),
    ` * @blueprintId ${node.id}`,
    " */"
  ];

  return `${lines.join("\n")}\n`;
};

const unwrapPromiseType = (value: string): string | null => {
  const match = value.trim().match(/^Promise<(.+)>$/);
  return match ? match[1].trim() : null;
};

const buildReturnExpression = (returnType: string): string | null => {
  const normalizedType = returnType.trim();
  if (!normalizedType || normalizedType === "void") {
    return null;
  }

  const promisedType = unwrapPromiseType(normalizedType);
  if (promisedType) {
    const innerExpression = buildReturnExpression(promisedType) ?? "undefined";
    return `Promise.resolve(${innerExpression})`;
  }

  if (normalizedType === "string") {
    return '""';
  }

  if (normalizedType === "number" || normalizedType === "bigint") {
    return "0";
  }

  if (normalizedType === "boolean") {
    return "false";
  }

  if (normalizedType === "null") {
    return "null";
  }

  if (normalizedType === "unknown" || normalizedType === "any") {
    return "undefined";
  }

  if (
    normalizedType.startsWith("Array<") ||
    normalizedType.startsWith("ReadonlyArray<") ||
    normalizedType.endsWith("[]")
  ) {
    return `[] as ${normalizedType}`;
  }

  return `undefined as unknown as ${normalizedType}`;
};

const buildScaffoldNotice = (node: BlueprintNode): string[] => {
  const notes = [
    `const scaffoldStatus = "CodeFlow scaffold for ${node.id}"`,
    "console.warn(scaffoldStatus)"
  ];

  return notes.map((line) => `  ${line};`);
};

const buildChecklistComment = (node: BlueprintNode): string[] => {
  const contract = normalizeContract(node.contract);

  return [
    ...contract.responsibilities.map((item) => `// TODO: ${item}`),
    ...contract.calls.map((call) => `// TODO: integrate ${call.target}${call.description ? ` (${call.description})` : ""}`),
    ...contract.errors.map((error) => `// TODO: handle ${error}`)
  ];
};

const buildFunctionCode = (node: BlueprintNode): string => {
  const contract = normalizeContract(node.contract);
  const functionName = sanitizeIdentifier(node.name.split(".").pop() ?? node.name);
  const inputList = contract.inputs
    .map((field) => `${sanitizeIdentifier(field.name)}: ${field.type || "unknown"}`)
    .join(", ");
  const returnType = contract.outputs[0]?.type || "void";
  const checklist = buildChecklistComment(node);
  const scaffoldNotice = buildScaffoldNotice(node);

  return `${buildDocComment(node)}export function ${functionName}(${inputList}): ${returnType} {
${scaffoldNotice.join("\n")}
${checklist.length ? `  ${checklist.join("\n  ")}\n` : ""}  throw new Error("CodeFlow scaffold: implementation required for ${node.id}");
}
`;
};

const buildApiCode = (node: BlueprintNode): string => {
  const functionName = sanitizeIdentifier(node.name.replace(/\s+/g, " "));
  const checklist = buildChecklistComment(node);

  return `${buildDocComment(node)}export async function ${functionName}(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
${buildScaffoldNotice(node).join("\n")}
${checklist.length ? `  ${checklist.join("\n  ")}\n` : ""}  return Response.json(
    {
      ok: false,
      blueprintId: "${node.id}",
      route: "${node.name}",
      maturity: "scaffold",
      received: body
    },
    { status: 501 }
  );
}
`;
};

const buildUiScreenCode = (node: BlueprintNode): string => {
  const contract = normalizeContract(node.contract);
  const componentName = toPascalCase(node.name);
  const attributeNotes = contract.attributes.length
    ? contract.attributes.map((attribute) => `      <li>${attribute.name}: ${attribute.type}</li>`).join("\n")
    : '      <li>No state model defined yet.</li>';
  const responsibilityNotes = contract.responsibilities.length
    ? contract.responsibilities.map((item) => `        <li>${item}</li>`).join("\n")
    : "        <li>Implementation responsibilities will appear here once the screen is wired.</li>";

  return `${buildDocComment(node)}export default function ${componentName}(): JSX.Element {
  return (
    <main data-codeflow-maturity="scaffold">
      <h1>${node.name}</h1>
      <p>${node.summary}</p>
      <p>This screen is a scaffold artifact. Replace the placeholder structure with real UI before shipping.</p>
      <section>
        <h2>Responsibilities</h2>
        <ul>
${responsibilityNotes}
        </ul>
      </section>
      <section>
        <h2>State / attributes</h2>
        <ul>
${attributeNotes}
        </ul>
      </section>
    </main>
  );
}
`;
};

const buildClassCode = (node: BlueprintNode, graph: BlueprintGraph): string => {
  const contract = normalizeContract(node.contract);
  const className = toPascalCase(node.name);
  const ownedMethods = graph.nodes.filter((candidate) => candidate.ownerId === node.id && candidate.kind === "function");
  const attributes = contract.attributes.length
    ? contract.attributes
        .map((attribute) => `  ${sanitizeIdentifier(attribute.name)}: ${attribute.type};`)
        .join("\n")
    : "  // TODO: add class attributes from the blueprint.";
  const methods = (ownedMethods.length ? ownedMethods : [])
    .map((methodNode) => {
      const methodName = sanitizeIdentifier(methodNode.name.split(".").pop() ?? methodNode.name);
      const methodContract = normalizeContract(methodNode.contract);
      const inputList = methodContract.inputs
        .map((field) => `${sanitizeIdentifier(field.name)}: ${field.type || "unknown"}`)
        .join(", ");
      const returnType = methodContract.outputs[0]?.type || "void";

      return `  ${buildDocComment(methodNode)
        .trimEnd()
        .split("\n")
        .map((line) => (line.startsWith(" *") || line.startsWith("/**") || line.startsWith(" */") ? `  ${line}` : line))
        .join("\n")}
  ${methodName}(${inputList}): ${returnType} {
    throw new Error("CodeFlow scaffold: implementation required for ${methodNode.id}");
  }`;
    })
    .join("\n\n");

  return `${buildDocComment(node)}export class ${className} {
${attributes}

${methods || "  // TODO: add methods from the blueprint contract."}
}
`;
};

export const generateNodeCode = (node: BlueprintNode, graph: BlueprintGraph): string | null => {
  if (!isCodeBearingNode(node)) {
    return null;
  }

  if (node.kind === "function") {
    return buildFunctionCode(node);
  }

  if (node.kind === "api") {
    return buildApiCode(node);
  }

  if (node.kind === "ui-screen") {
    return buildUiScreenCode(node);
  }

  if (node.kind === "class") {
    return buildClassCode(node, graph);
  }

  return null;
};
