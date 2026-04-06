import type { Node as TSNode, Tree } from "web-tree-sitter";

import type {
  BlueprintEdge,
  BlueprintNode,
  BlueprintNodeKind
} from "../schema/index.js";
import { emptyContract } from "../schema/index.js";
import { createNode, createNodeId, dedupeEdges, mergeContracts, toPosixPath } from "../internal/utils.js";

import type { SupportedLanguage } from "./tree-sitter-loader.js";
import { getLanguageFromPath, setParserLanguage } from "./tree-sitter-loader.js";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const namedChildren = (node: TSNode | null): TSNode[] => {
  if (!node) return [];
  return node.namedChildren.filter((c): c is TSNode => c !== null);
};

const extractCommentText = (node: TSNode): string => {
  const comments: string[] = [];
  let sibling: TSNode | null = node.previousNamedSibling;

  while (sibling) {
    if (sibling.type.includes("comment") || sibling.type.includes("block_comment") || sibling.type.includes("line_comment")) {
      const text = sibling.text
        .replace(/^(\/\/|\/\*|\*|#)/g, "")
        .replace(/(\*\/|\*|\n)/g, " ")
        .trim();
      if (text) comments.unshift(text);
      sibling = sibling.previousNamedSibling;
    } else {
      break;
    }
  }

  return comments.join(" ").trim();
};

const extractPythonDocstring = (bodyNode: TSNode | null): string => {
  if (!bodyNode) return "";
  for (const child of namedChildren(bodyNode)) {
    if (child.type === "expression_statement") {
      const strNode = child.namedChild(0);
      if (strNode && (strNode.type === "string" || strNode.type === "string_content")) {
        return strNode.text.replace(/^("""|'''|\"|')/, "").replace(/("""|'''|\"|')$/, "").trim().split("\n")[0].trim();
      }
    }
  }
  return "";
};

const buildSummary = (
  name: string,
  node: TSNode,
  bodyNode: TSNode | null,
  params: Array<{ name: string; type: string }>,
  returnType: string
): string => {
  const comment = extractCommentText(node);
  if (comment) return comment.split("\n")[0].trim();

  const docstring = extractPythonDocstring(bodyNode);
  if (docstring) return docstring;

  const paramPart = params.length > 0 ? ` that takes ${params.length} param${params.length > 1 ? "s" : ""}` : "";
  const returnPart = returnType && returnType !== "void" && returnType !== "unknown" && returnType !== "None"
    ? ` and returns ${returnType}`
    : "";
  return `${name}${paramPart}${returnPart}.`;
};

const buildSignature = (
  name: string,
  params: Array<{ name: string; type: string }>,
  returnType: string,
  language: SupportedLanguage
): string => {
  const paramStr = params.map(p => p.type !== "unknown" ? `${p.name}: ${p.type}` : p.name).join(", ");
  const ret = returnType && returnType !== "unknown" && returnType !== "void" ? returnType : "";

  switch (language) {
    case "go": return `func ${name}(${paramStr})${ret ? " " + ret : ""}`;
    case "python": return `def ${name}(${paramStr})${ret ? ` -> ${ret}` : ""}`;
    case "c":
    case "cpp": return `${ret || "void"} ${name}(${paramStr})`;
    case "rust": return `fn ${name}(${paramStr})${ret ? ` -> ${ret}` : ""}`;
    default: return `${name}(${paramStr})${ret ? `: ${ret}` : ""}`;
  }
};

const findChild = (node: TSNode | null, ...types: string[]): TSNode | null => {
  if (!node) return null;
  for (const child of namedChildren(node)) {
    if (types.includes(child.type)) return child;
  }
  return null;
};

const extractParams = (paramNode: TSNode | null): Array<{ name: string; type: string }> => {
  if (!paramNode) return [];
  const params: Array<{ name: string; type: string }> = [];

  const walk = (n: TSNode) => {
    if (n.type === "parameter_declaration" || n.type === "typed_parameter" || n.type === "parameter") {
      let name = "";
      let type = "";

      for (const c of namedChildren(n)) {
        if (c.type === "identifier" || c.type === "variable_declarator") name = c.text;
        else if (c.type === "type_identifier" || c.type === "primitive_type" || c.type === "sized_type_specifier") type = c.text;
        else if (c.type === "type_annotation") type = c.text.replace(/^:\s*/, "").trim();
      }

      const nameNode = n.childForFieldName("name") || n.childForFieldName("pattern");
      if (nameNode && !name) name = nameNode.text;
      const typeNode = n.childForFieldName("type");
      if (typeNode && !type) type = typeNode.text;

      if (name) params.push({ name, type: type || "unknown" });
      return;
    }
    for (const c of namedChildren(n)) walk(c);
  };

  walk(paramNode);
  return params;
};

const extractReturnType = (returnNode: TSNode | null): string => {
  if (!returnNode) return "";
  const typeNode = returnNode.childForFieldName("type")
    || returnNode.childForFieldName("value")
    || returnNode.namedChild(0);
  if (typeNode) return typeNode.text.replace(/^\(|\)$/g, "").trim();
  return returnNode.text.replace(/^\(|\)$/g, "").trim() || "";
};

interface ExtractedNode {
  nodeId: string;
  kind: BlueprintNodeKind;
  name: string;
  summary: string;
  path: string;
  signature: string;
  sourceRefs: Array<{ kind: "repo"; path: string; symbol?: string }>;
  ownerId?: string;
}

const detectKind = (name: string, relativePath: string, language: SupportedLanguage): BlueprintNodeKind => {
  if (language === "typescript" || language === "javascript") {
    const baseName = relativePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    if (baseName === "route" && HTTP_METHODS.has(name)) return "api";
    if (baseName === "page" && name.toLowerCase().includes("page")) return "ui-screen";
  }
  return "function";
};

export const extractNodesFromFile = async (
  filePath: string,
  relativePath: string
): Promise<{
  nodes: ExtractedNode[];
  edges: BlueprintEdge[];
  symbolIndex: Map<string, string>;
  callEdges: Array<{ fromId: string; toName: string; callText: string }>;
  importEdges: Array<{ fromModuleId: string; importPath: string }>;
  inheritEdges: Array<{ fromId: string; toName: string }>;
}> => {
  const language = getLanguageFromPath(filePath);
  if (!language) {
    return { nodes: [], edges: [], symbolIndex: new Map(), callEdges: [], importEdges: [], inheritEdges: [] };
  }

  const parser = await setParserLanguage(language);
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(filePath, "utf-8");
  const tree = parser.parse(source);
  if (!tree) {
    return { nodes: [], edges: [], symbolIndex: new Map(), callEdges: [], importEdges: [], inheritEdges: [] };
  }

  const root = tree.rootNode;
  const nodes: ExtractedNode[] = [];
  const edges: BlueprintEdge[] = [];
  const symbolIndex = new Map<string, string>();
  const callEdges: Array<{ fromId: string; toName: string; callText: string }> = [];
  const importEdges: Array<{ fromModuleId: string; importPath: string }> = [];
  const inheritEdges: Array<{ fromId: string; toName: string }> = [];

  const moduleId = createNodeId("module", relativePath, relativePath);
  nodes.push({
    nodeId: moduleId,
    kind: "module",
    name: relativePath,
    summary: `Source module ${relativePath}.`,
    path: relativePath,
    signature: "",
    sourceRefs: [{ kind: "repo", path: relativePath }]
  });

  const recordFunc = (
    funcName: string,
    funcNode: TSNode,
    paramsNode: TSNode | null,
    returnTypeNode: TSNode | null,
    bodyNode: TSNode | null,
    ownerName?: string,
    ownerId?: string
  ) => {
    if (!funcName) return;
    const params = extractParams(paramsNode);
    const returnType = returnTypeNode ? extractReturnType(returnTypeNode) : "";
    const displayName = ownerName ? `${ownerName}.${funcName}` : funcName;
    const summary = buildSummary(displayName, funcNode, bodyNode, params, returnType);
    const signature = buildSignature(funcName, params, returnType, language);
    const kind = detectKind(funcName, relativePath, language);
    const isMethod = !!ownerName;
    const nodeId = createNodeId(kind, `${relativePath}:${displayName}`, `${relativePath}:${displayName}`);

    nodes.push({
      nodeId,
      kind,
      name: displayName,
      summary,
      path: relativePath,
      signature,
      sourceRefs: [{ kind: "repo", path: relativePath, symbol: displayName }],
      ownerId: isMethod ? ownerId : (kind === "function" ? moduleId : undefined)
    });

    symbolIndex.set(`${relativePath}::${ownerName ? `${ownerName}.` : ""}${funcName}`, nodeId);
    symbolIndex.set(`${relativePath}::${funcName}`, nodeId);

    collectCalls(funcNode, nodeId);
  };

  const collectCalls = (node: TSNode, callerId: string) => {
    for (const child of namedChildren(node)) {
      let calleeName = "";

      if (child.type === "call_expression" || child.type === "call") {
        const funcNode = child.namedChild(0);
        if (funcNode) {
          if (funcNode.type === "identifier" || funcNode.type === "variable_identifier") {
            calleeName = funcNode.text;
          } else if (funcNode.type === "member_expression" || funcNode.type === "selector_expression" || funcNode.type === "field_expression" || funcNode.type === "attribute") {
            const propNode = findChild(funcNode, "property_identifier", "field_identifier", "identifier");
            if (propNode) calleeName = propNode.text;
          } else if (funcNode.type === "scoped_identifier" || funcNode.type === "qualified_identifier") {
            const nameNode = findChild(funcNode, "identifier", "field_identifier");
            if (nameNode) calleeName = nameNode.text;
          }
        }
      }

      if (calleeName) {
        callEdges.push({ fromId: callerId, toName: calleeName, callText: child.text });
      }

      collectCalls(child, callerId);
    }
  };

  const walkFunctions = (node: TSNode, ownerName?: string, ownerId?: string) => {
    for (const child of namedChildren(node)) {
      let funcName = "";
      let paramsNode: TSNode | null = null;
      let returnTypeNode: TSNode | null = null;
      let bodyNode: TSNode | null = null;
      let isMethod = false;

      if (child.type === "function_declaration" || child.type === "function_definition") {
        const nameNode = findChild(child, "identifier");
        if (!nameNode) { walkFunctions(child, ownerName, ownerId); continue; }
        funcName = nameNode.text;
        paramsNode = findChild(child, "parameter_list", "parameters", "formal_parameters");
        const resultNode = findChild(child, "result");
        returnTypeNode = resultNode
          ? findChild(resultNode, "type_identifier", "primitive_type", "sized_type_specifier", "tuple_type", "generic_type", "pointer_type", "array_type")
          : findChild(child, "type_identifier", "type_annotation");
        bodyNode = findChild(child, "block", "statement_block", "compound_statement");
      } else if (child.type === "method_declaration") {
        funcName = findChild(child, "field_identifier")?.text || "";
        paramsNode = findChild(child, "parameter_list", "parameters");
        const resultNode = findChild(child, "result");
        if (resultNode) {
          returnTypeNode = findChild(resultNode, "type_identifier", "primitive_type", "sized_type_specifier", "tuple_type", "generic_type", "pointer_type", "array_type");
        }
        bodyNode = findChild(child, "block");
        isMethod = true;
      } else if ((child.type === "method_definition") || (child.type === "function_definition" && ownerName)) {
        const nameNode = findChild(child, "identifier", "property_identifier");
        if (!nameNode) { walkFunctions(child, ownerName, ownerId); continue; }
        funcName = nameNode.text;
        paramsNode = findChild(child, "parameters", "formal_parameters");
        const retNode = findChild(child, "type_annotation");
        if (retNode) {
          returnTypeNode = findChild(retNode, "type_identifier", "primitive_type", "predefined_type") || retNode;
        }
        bodyNode = findChild(child, "statement_block", "block");
        isMethod = true;
      } else if (child.type === "function_item") {
        const nameNode = findChild(child, "identifier");
        if (!nameNode) { walkFunctions(child); continue; }
        funcName = nameNode.text;
        paramsNode = findChild(child, "parameters");
        for (const n of namedChildren(child)) {
          if (n.type === "->") {
            const idx = child.namedChildren.indexOf(n);
            if (idx >= 0 && child.namedChildren[idx + 1]) {
              returnTypeNode = child.namedChildren[idx + 1];
            }
            break;
          }
        }
        bodyNode = findChild(child, "block");
      } else if (child.type === "arrow_function" || child.type === "function_expression") {
        const parent = child.parent;
        if (parent?.type === "variable_declarator") {
          const nameN = findChild(parent, "identifier");
          if (nameN) funcName = nameN.text;
        }
        if (!funcName) { walkFunctions(child, ownerName, ownerId); continue; }
        paramsNode = findChild(child, "formal_parameters", "parameters");
        bodyNode = findChild(child, "statement_block", "block", "expression");
      }

      if (funcName) {
        recordFunc(funcName, child, paramsNode, returnTypeNode, bodyNode, ownerName, ownerId);
      }

      walkFunctions(child, ownerName, ownerId);
    }
  };

  const walkClasses = (node: TSNode) => {
    for (const child of namedChildren(node)) {
      let className = "";
      let parentClass = "";

      if (child.type === "class_declaration" || child.type === "class_specifier" || child.type === "struct_specifier") {
        const nameNode = findChild(child, "type_identifier", "identifier");
        if (!nameNode) { walkClasses(child); continue; }
        className = nameNode.text;

        const heritage = findChild(child, "class_heritage", "base_class_clause");
        if (heritage) {
          const parentNode = findChild(heritage, "type_identifier", "identifier");
          if (parentNode) parentClass = parentNode.text;
        }

        const summary = buildSummary(className, child, null, [], "");
        const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);

        nodes.push({
          nodeId: classId,
          kind: "class",
          name: className,
          summary,
          path: relativePath,
          signature: `class ${className}`,
          sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }],
          ownerId: moduleId
        });

        symbolIndex.set(`${relativePath}::${className}`, classId);
        if (parentClass) inheritEdges.push({ fromId: classId, toName: parentClass });
        walkFunctions(child, className, classId);
      } else if (child.type === "type_declaration") {
        const declarator = findChild(child, "type_identifier");
        const structType = findChild(child, "struct_type");
        if (declarator && structType) {
          className = declarator.text;
          const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
          nodes.push({
            nodeId: classId,
            kind: "class",
            name: className,
            summary: buildSummary(className, child, null, [], ""),
            path: relativePath,
            signature: `type ${className} struct`,
            sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }]
          });
          symbolIndex.set(`${relativePath}::${className}`, classId);
          walkFunctions(child, className, classId);
        }
      } else if (child.type === "struct_item" || child.type === "impl_item") {
        const nameNode = findChild(child, "type_identifier");
        if (!nameNode) { walkClasses(child); continue; }
        className = nameNode.text;
        const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
        nodes.push({
          nodeId: classId,
          kind: "class",
          name: className,
          summary: buildSummary(className, child, null, [], ""),
          path: relativePath,
          signature: child.type === "impl_item" ? `impl ${className}` : `struct ${className}`,
          sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }]
        });
        symbolIndex.set(`${relativePath}::${className}`, classId);
        walkFunctions(child, className, classId);
      }

      walkClasses(child);
    }
  };

  const walkImports = (node: TSNode) => {
    for (const child of namedChildren(node)) {
      let importPath = "";

      if (child.type === "import_statement") {
        const stringNode = findChild(child, "string");
        if (stringNode) importPath = stringNode.text.replace(/^["']|["']$/g, "");
      } else if (child.type === "import_declaration") {
        const specList = findChild(child, "import_spec_list");
        if (specList) {
          for (const spec of namedChildren(specList)) {
            if (spec.type === "import_spec") {
              const pathNode = findChild(spec, "interpreted_string_literal", "string_literal", "string");
              if (pathNode) importPath = pathNode.text.replace(/^["']|["']$/g, "");
            }
          }
        } else {
          const specNode = findChild(child, "import_spec");
          if (specNode) {
            const pathNode = findChild(specNode, "interpreted_string_literal", "string_literal", "string");
            if (pathNode) importPath = pathNode.text.replace(/^["']|["']$/g, "");
          }
        }
      } else if (child.type === "preproc_include") {
        const pathNode = findChild(child, "system_lib_string", "string_literal", "string");
        if (pathNode) importPath = pathNode.text.replace(/^<|>$/g, "").replace(/^["']|["']$/g, "");
      } else if (child.type === "import_from_statement") {
        const modNode = findChild(child, "dotted_name", "identifier");
        if (modNode) importPath = modNode.text;
      } else if (child.type === "use_declaration") {
        const argNode = child.namedChild(0);
        if (argNode) importPath = argNode.text;
      }

      if (importPath) {
        importEdges.push({ fromModuleId: moduleId, importPath });
      }

      walkImports(child);
    }
  };

  walkFunctions(root);
  walkClasses(root);
  walkImports(root);

  return { nodes, edges, symbolIndex, callEdges, importEdges, inheritEdges };
};
