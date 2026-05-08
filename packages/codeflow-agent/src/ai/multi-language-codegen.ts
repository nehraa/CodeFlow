/**
 * Multi-language code generation dispatcher.
 *
 * Routes scaffold generation to the correct language backend based on
 * `node.language` (defaults to "typescript"). Each language backend
 * produces a complete, compilable scaffold file content string.
 */

import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core/schema";
import { generateNodeCode } from "./scaffold-generator.js";
import { isCodeBearingNode } from "./scaffold-utils.js";

// ---------------------------------------------------------------------------
// Language backends
// ---------------------------------------------------------------------------

/** Stub for Python nodes — produces a minimal Python module. */
export const generatePythonScaffold = (node: BlueprintNode): string => {
  const name = node.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const inputs = (node.contract?.inputs ?? [])
    .map((f: { name: string; type?: string }) => `${f.name}: ${pythonType(f.type)}`)
    .join(", ");
  const output = pythonType(node.contract?.outputs?.[0]?.type ?? "None");
  const doc = pythonDocComment(node);

  return `${doc}def ${name}(${inputs}) -> ${output}:\n    raise NotImplementedError("CodeFlow scaffold: implementation required for ${node.id}")\n`;
};

/** Stub for Go function nodes — produces a Go func with error return. */
export const generateGoScaffold = (node: BlueprintNode): string => {
  const name = goName(node.name);
  const inputs = (node.contract?.inputs ?? [])
    .map((f: { name: string; type?: string }) => `${f.name} ${goType(f.type)}`)
    .join(", ");
  const output = goType(node.contract?.outputs?.[0]?.type ?? "");
  const sig = output ? `${name}(${inputs}) (${output}, error)` : `${name}(${inputs})`;
  const doc = goDocComment(node);

  return `${doc}func ${sig} {\n\treturn ${goZeroValue(output)}, errors.New("CodeFlow scaffold: implementation required for ${node.id}")\n}\n`;
};

/** Stub for Rust function nodes — produces a Rust fn with Result return. */
export const generateRustScaffold = (node: BlueprintNode): string => {
  const name = rustName(node.name);
  const inputs = (node.contract?.inputs ?? [])
    .map((f: { name: string; type?: string }) => `${f.name}: ${rustType(f.type)}`)
    .join(", ");
  const output = rustType(node.contract?.outputs?.[0]?.type ?? "()");
  const doc = rustDocComment(node);

  return `${doc}pub fn ${name}(${inputs}) -> Result<${output}, Box<dyn std::error::Error>> {\n    todo!("CodeFlow scaffold: implementation required for ${node.id}")\n}\n`;
};

// ---------------------------------------------------------------------------
// Python helpers
// ---------------------------------------------------------------------------

const pythonType = (tsType: string = "Any") =>
  ({
    string: "str",
    number: "float",
    boolean: "bool",
    object: "dict",
    array: "list",
    null: "None"
  })[tsType.toLowerCase()] ?? "Any";

const pythonDocComment = (node: BlueprintNode): string => {
  const lines = ['"""', ` ${node.summary}`, ` @blueprintId ${node.id}`, ' """'];
  return lines.join("\n") + "\n";
};

// ---------------------------------------------------------------------------
// Go helpers
// ---------------------------------------------------------------------------

const goName = (name: string) =>
  name
    .split(".")
    .pop()!
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^([a-z])/, (_, c: string) => c.toUpperCase());

const goType = (tsType: string = "") =>
  ({
    string: "string",
    number: "int",
    boolean: "bool",
    object: "map[string]interface{}",
    array: "[]interface{}",
    null: "nil"
  })[tsType.toLowerCase()] ?? "interface{}";

const goZeroValue = (goType: string = ""): string => {
  if (!goType || goType === "nil") return "nil";
  if (goType === "string") return '""';
  if (goType === "int" || goType === "int64") return "0";
  if (goType === "bool") return "false";
  if (goType === "map[string]interface{}") return "nil";
  if (goType === "[]interface{}") return "nil";
  return "nil";
};

const goDocComment = (node: BlueprintNode): string => {
  const lines = [`// ${node.summary}`, `// @blueprintId ${node.id}`];
  return lines.map((l) => l + "\n").join("");
};

// ---------------------------------------------------------------------------
// Rust helpers
// ---------------------------------------------------------------------------

const rustName = (name: string) =>
  name
    .split(".")
    .pop()!
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^([a-z])/, (_, c: string) => c.toLowerCase());

const rustType = (tsType: string = "()") =>
  ({
    string: "String",
    number: "i64",
    boolean: "bool",
    object: "serde_json::Value",
    array: "Vec<serde_json::Value>",
    null: "()"
  })[tsType.toLowerCase()] ?? "serde_json::Value";

const rustDocComment = (node: BlueprintNode): string => {
  const lines = [`/// ${node.summary}`, `/// @blueprintId ${node.id}`];
  return lines.map((l) => l + "\n").join("");
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Detect the target language from a node's `language` field or path extension.
 * Returns 'typescript' by default.
 */
export const detectTargetLanguage = (node: BlueprintNode & { language?: string }): string => {
  if ((node as { language?: string }).language) return (node as { language?: string }).language ?? 'typescript';
  if (node.path) {
    if (node.path.endsWith('.py')) return 'python';
    if (node.path.endsWith('.go')) return 'go';
    if (node.path.endsWith('.rs')) return 'rust';
  }
  return 'typescript';
};

/**
 * Generates a scaffold file for the given node in the language specified
 * by `node.language` (defaults to "typescript").
 *
 * For TypeScript nodes, delegates to `generateNodeCode` from scaffold-generator.
 * For Python / Go / Rust nodes, uses language-specific backends.
 * Returns null for non-code-bearing nodes.
 */
export const generateMultiLanguageCode = (
  node: BlueprintNode,
  graph: BlueprintGraph
): string | null => {
  if (!isCodeBearingNode(node)) {
    return null;
  }

  const lang = detectTargetLanguage(node);

  if (lang === "python") {
    return generatePythonScaffold(node);
  }

  if (lang === "go") {
    return generateGoScaffold(node);
  }

  if (lang === "rust") {
    return generateRustScaffold(node);
  }

  // Default: TypeScript (use existing scaffold-generator)
  return generateNodeCode(node as any, graph as any);
};
