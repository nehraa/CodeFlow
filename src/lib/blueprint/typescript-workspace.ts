import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { generateNodeCode, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import type { BlueprintGraph, BlueprintNode } from "@/lib/blueprint/schema";

export type WorkspaceDiagnosticIssue = {
  filePath?: string;
  line?: number;
  column?: number;
  message: string;
};

export type WorkspaceCompileResult = {
  success: boolean;
  diagnostics: string;
  issues: WorkspaceDiagnosticIssue[];
};

const projectNodeModulesDir = path.resolve(process.cwd(), "node_modules");

const BUILTIN_TYPE_IDENTIFIERS = new Set([
  "Array",
  "Awaited",
  "Blob",
  "Date",
  "Element",
  "Error",
  "Exclude",
  "Extract",
  "File",
  "FormData",
  "Headers",
  "JSX",
  "Map",
  "NonNullable",
  "Omit",
  "Parameters",
  "Partial",
  "Pick",
  "Promise",
  "Readonly",
  "ReadonlyArray",
  "Record",
  "Request",
  "Required",
  "Response",
  "ReturnType",
  "Set",
  "URL",
  "Uint8Array",
  "any",
  "boolean",
  "false",
  "never",
  "null",
  "number",
  "object",
  "string",
  "true",
  "undefined",
  "unknown",
  "void"
]);

export const writeWorkspaceFile = async (
  workspaceDir: string,
  relativePath: string,
  content: string
): Promise<void> => {
  const targetPath = path.join(workspaceDir, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
};

export const normalizeRelativeImports = (source: string): string =>
  source.replace(
    /(from\s+["'])(\.{1,2}\/[^"'.]+)(["'])/g,
    (_, prefix: string, importPath: string, suffix: string) => `${prefix}${importPath}.js${suffix}`
  );

export const getNodeSource = (
  node: BlueprintNode,
  graph: BlueprintGraph,
  codeDrafts?: Record<string, string>,
  overrideCode?: string
): string | null =>
  overrideCode ??
  codeDrafts?.[node.id] ??
  node.implementationDraft ??
  node.specDraft ??
  generateNodeCode(node, graph);

const extractCustomTypeNames = (graph: BlueprintGraph): string[] => {
  const typeNames = new Set<string>();

  const collect = (value?: string) => {
    if (!value) {
      return;
    }

    for (const token of value.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
      if (BUILTIN_TYPE_IDENTIFIERS.has(token)) {
        continue;
      }
      if (/^[a-z]+$/.test(token)) {
        continue;
      }
      typeNames.add(token);
    }
  };

  for (const node of graph.nodes) {
    for (const field of node.contract.inputs) {
      collect(field.type);
    }
    for (const field of node.contract.outputs) {
      collect(field.type);
    }
    for (const field of node.contract.attributes) {
      collect(field.type);
    }
    for (const method of node.contract.methods) {
      for (const field of method.inputs) {
        collect(field.type);
      }
      for (const field of method.outputs) {
        collect(field.type);
      }
    }
  }

  return [...typeNames].sort();
};

const buildTypeShimFile = (graph: BlueprintGraph): string => {
  const typeNames = extractCustomTypeNames(graph);
  if (!typeNames.length) {
    return "export {};\n";
  }

  return `${typeNames.map((typeName) => `declare type ${typeName} = any;`).join("\n")}\n`;
};

const ensureWorkspaceNodeModules = async (workspaceDir: string): Promise<void> => {
  const targetPath = path.join(workspaceDir, "node_modules");
  const exists = await fs
    .lstat(targetPath)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    return;
  }

  await fs.symlink(
    projectNodeModulesDir,
    targetPath,
    process.platform === "win32" ? "junction" : "dir"
  );
};

export const initializeTypeScriptWorkspace = async (
  workspaceDir: string,
  graph: BlueprintGraph
): Promise<void> => {
  await writeWorkspaceFile(
    workspaceDir,
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["ES2022", "DOM"],
          outDir: "dist",
          rootDir: ".",
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
          jsx: "react-jsx"
        },
        include: ["codeflow-shims.d.ts", "entrypoint.ts", "stubs/**/*.ts", "stubs/**/*.tsx"]
      },
      null,
      2
    )
  );

  await writeWorkspaceFile(
    workspaceDir,
    "package.json",
    JSON.stringify({ name: "codeflow-runtime-workspace", private: true, type: "module" }, null, 2)
  );

  await writeWorkspaceFile(workspaceDir, "codeflow-shims.d.ts", buildTypeShimFile(graph));
  await ensureWorkspaceNodeModules(workspaceDir);
};

export const writeBlueprintGraphToWorkspace = async (
  workspaceDir: string,
  graph: BlueprintGraph,
  codeDrafts?: Record<string, string>,
  codeOverrides?: Record<string, string>
): Promise<void> => {
  for (const node of graph.nodes) {
    const stubPath = getNodeStubPath(node);
    const content = stubPath
      ? getNodeSource(node, graph, codeDrafts, codeOverrides?.[node.id])
      : null;

    if (!stubPath || !content || !isCodeBearingNode(node)) {
      continue;
    }

    await writeWorkspaceFile(workspaceDir, stubPath, normalizeRelativeImports(content));
  }
};

export const compileTypeScriptWorkspace = (
  workspaceDir: string,
  options: { noEmit?: boolean } = {}
): WorkspaceCompileResult => {
  const configPath = path.join(workspaceDir, "tsconfig.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const formatHost = {
    getCanonicalFileName: (fileName: string) => fileName,
    getCurrentDirectory: () => workspaceDir,
    getNewLine: () => "\n"
  };

  if (configFile.error) {
    return {
      success: false,
      diagnostics: ts.formatDiagnosticsWithColorAndContext([configFile.error], formatHost),
      issues: [
        {
          message: ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")
        }
      ]
    };
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    workspaceDir,
    options.noEmit ? { noEmit: true } : undefined,
    configPath
  );

  if (parsedConfig.errors.length) {
    return {
      success: false,
      diagnostics: ts.formatDiagnosticsWithColorAndContext(parsedConfig.errors, formatHost),
      issues: parsedConfig.errors.map((diagnostic) => ({
        filePath: diagnostic.file?.fileName,
        line:
          diagnostic.file && diagnostic.start != null
            ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
            : undefined,
        column:
          diagnostic.file && diagnostic.start != null
            ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).character + 1
            : undefined,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      }))
    };
  }

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options
  });
  const diagnostics = [...ts.getPreEmitDiagnostics(program)];

  if (!options.noEmit) {
    const emitResult = program.emit();
    diagnostics.push(...emitResult.diagnostics);
  }

  return {
    success: diagnostics.length === 0,
    diagnostics:
      diagnostics.length > 0
        ? ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost)
        : "",
    issues: diagnostics.map((diagnostic) => ({
      filePath: diagnostic.file?.fileName,
      line:
        diagnostic.file && diagnostic.start != null
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
          : undefined,
      column:
        diagnostic.file && diagnostic.start != null
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).character + 1
          : undefined,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    }))
  };
};
