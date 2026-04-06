import type { SyntaxNode, Tree } from "web-tree-sitter";

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

const extractCommentText = (node: SyntaxNode): string => {
  const comments: string[] = [];
  let sibling: SyntaxNode | null = node.previousNamedSibling;

  while (sibling) {
    if (sibling.type.includes("comment") || sibling.type.includes("block_comment") || sibling.type.includes("line_comment")) {
      const text = sibling.text
        .replace(/^(\/\/|\/\*|\*|#)/g, "")
        .replace(/(\*\/|\*|\n)/g, " ")
        .trim();
      if (text) {
        comments.unshift(text);
      }
      sibling = sibling.previousNamedSibling;
    } else {
      break;
    }
  }

  return comments.join(" ").trim();
};

const extractPythonDocstring = (bodyNode: SyntaxNode | null): string => {
  if (!bodyNode) return "";

  for (const child of bodyNode.namedChildren) {
    if (child.type === "expression_statement") {
      const strNode = child.namedChild(0);
      if (strNode && (strNode.type === "string" || strNode.type === "string_content")) {
        const raw = strNode.text;
        const cleaned = raw.replace(/^("""|'''|\"|')/, "").replace(/("""|'''|\"|')$/, "").trim();
        if (cleaned) return cleaned.split("\n")[0].trim();
      }
    }
  }
  return "";
};

const getSummary = (
  name: string,
  node: SyntaxNode,
  bodyNode: SyntaxNode | null,
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

const getSignature = (
  name: string,
  params: Array<{ name: string; type: string }>,
  returnType: string,
  language: SupportedLanguage
): string => {
  const paramStr = params.map(p => p.type !== "unknown" ? `${p.name}: ${p.type}` : p.name).join(", ");
  const ret = returnType && returnType !== "unknown" && returnType !== "void" ? returnType : "";

  switch (language) {
    case "go":
      return `func ${name}(${paramStr})${ret ? " " + ret : ""}`;
    case "python":
      return `def ${name}(${paramStr})${ret ? ` -> ${ret}` : ""}`;
    case "c":
    case "cpp":
      return `${ret || "void"} ${name}(${paramStr})`;
    case "rust":
      return `fn ${name}(${paramStr})${ret ? ` -> ${ret}` : ""}`;
    default:
      return `${name}(${paramStr})${ret ? `: ${ret}` : ""}`;
  }
};

const findChildByType = (node: SyntaxNode, ...types: string[]): SyntaxNode | null => {
  for (const child of node.namedChildren) {
    if (types.includes(child.type)) return child;
  }
  return null;
};

const collectAllDescendantsOfType = (node: SyntaxNode, ...types: string[]): SyntaxNode[] => {
  const results: SyntaxNode[] = [];
  const queue = [...node.namedChildren];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (types.includes(current.type)) results.push(current);
    queue.push(...current.namedChildren);
  }

  return results;
};

const extractParamsFromNode = (paramNode: SyntaxNode | null): Array<{ name: string; type: string }> => {
  if (!paramNode) return [];

  const params: Array<{ name: string; type: string }> = [];

  const walkParam = (node: SyntaxNode) => {
    if (node.type === "parameter_declaration" || node.type === "typed_parameter" || node.type === "parameter") {
      let name = "";
      let type = "";

      for (const child of node.namedChildren) {
        if (child.type === "identifier" || child.type === "variable_declarator") {
          name = child.text;
        } else if (child.type === "type_identifier" || child.type === "primitive_type" || child.type === "sized_type_specifier") {
          type = child.text;
        } else if (child.type === "type_annotation") {
          type = child.text.replace(/^:\s*/, "").trim();
        }
      }

      if (!name) {
        const nameNode = node.childForFieldName("name") || node.childForFieldName("pattern");
        if (nameNode) name = nameNode.text;
      }
      if (!type) {
        const typeNode = node.childForFieldName("type");
        if (typeNode) type = typeNode.text;
      }

      if (name) params.push({ name, type: type || "unknown" });
      return;
    }

    for (const child of node.namedChildren) {
      walkParam(child);
    }
  };

  walkParam(paramNode);
  return params;
};

const extractReturnTypeFromNode = (returnNode: SyntaxNode | null): string => {
  if (!returnNode) return "";

  const typeNode = returnNode.childForFieldName("type")
    || returnNode.childForFieldName("value")
    || returnNode.namedChild(0);

  if (typeNode) {
    return typeNode.text.replace(/^\(|\)$/g, "").trim();
  }

  const text = returnNode.text.replace(/^\(|\)$/g, "").trim();
  return text || "";
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

const detectNodeKind = (
  name: string,
  relativePath: string,
  language: SupportedLanguage,
  isMethod: boolean
): BlueprintNodeKind => {
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

  const findFunctions = (node: SyntaxNode, ownerName?: string, ownerId?: string) => {
    for (const child of node.namedChildren) {
      let funcName = "";
      let paramsNode: SyntaxNode | null = null;
      let returnTypeNode: SyntaxNode | null = null;
      let bodyNode: SyntaxNode | null = null;
      let isMethod = false;

      if (child.type === "function_declaration" || child.type === "function_definition") {
        const nameNode = findChildByType(child, "identifier");
        if (!nameNode) { child.type === "function_declaration"; continue; }
        funcName = nameNode.text;
        paramsNode = findChildByType(child, "parameter_list", "parameters", "formal_parameters");
        returnTypeNode = findChildByType(child, "type_identifier", "primitive_type", "type_annotation", "result");
        if (!returnTypeNode) {
          const resultNode = findChildByType(child, "result");
          if (resultNode) {
            const typeNode = findChildByType(resultNode, "type_identifier", "primitive_type", "sized_type_specifier", "tuple_type", "generic_type", "pointer_type", "array_type");
            if (typeNode) returnTypeNode = typeNode;
          }
        }
        bodyNode = findChildByType(child, "block", "statement_block", "compound_statement");
      } else if (child.type === "method_declaration") {
        funcName = findChildByType(child, "field_identifier")?.text || "";
        paramsNode = findChildByType(child, "parameter_list", "parameters");
        const resultNode = findChildByType(child, "result");
        if (resultNode) {
          returnTypeNode = findChildByType(resultNode, "type_identifier", "primitive_type", "sized_type_specifier", "tuple_type", "generic_type", "pointer_type", "array_type");
        }
        bodyNode = findChildByType(child, "block");
        isMethod = true;
        const receiverNode = findChildByType(child, "parameter_list");
        if (receiverNode && child.namedChildren.indexOf(receiverNode) === 0) {
          ownerName = findChildByType(receiverNode, "identifier", "type_identifier")?.text || ownerName;
        }
      } else if (child.type === "method_definition" || (child.type === "function_definition" && ownerName)) {
        const nameNode = findChildByType(child, "identifier", "property_identifier");
        if (!nameNode) { findFunctions(child, ownerName, ownerId); continue; }
        funcName = nameNode.text;
        paramsNode = findChildByType(child, "parameters", "formal_parameters");
        const retNode = findChildByType(child, "type_annotation");
        if (retNode) {
          returnTypeNode = findChildByType(retNode, "type_identifier", "primitive_type", "predefined_type");
          if (!returnTypeNode) returnTypeNode = retNode;
        }
        bodyNode = findChildByType(child, "statement_block", "block");
        isMethod = true;
      } else if (child.type === "function_item") {
        const nameNode = findChildByType(child, "identifier");
        if (!nameNode) { findFunctions(child); continue; }
        funcName = nameNode.text;
        paramsNode = findChildByType(child, "parameters");
        const retNode = findChildByType(child, "type_identifier", "primitive_type");
        if (!retNode) {
          const allTypes = child.namedChildren.filter(n => n.type === "type_identifier" || n.type === "primitive_type" || n.type === "generic_type" || n.type === "reference_type" || n.type === "tuple_type");
          for (const t of allTypes) {
            const prev = child.namedChildren[child.namedChildren.indexOf(t) - 1];
            if (prev && prev.type === "->") {
              returnTypeNode = t;
              break;
            }
          }
        }
        if (!returnTypeNode && retNode) returnTypeNode = retNode;
        bodyNode = findChildByType(child, "block");
      } else if (child.type === "arrow_function" || child.type === "function_expression") {
        const parent = child.parent;
        if (parent && (parent.type === "variable_declarator" || parent.type === "lexical_declaration")) {
          const nameN = findChildByType(parent, "identifier");
          if (nameN) funcName = nameN.text;
        }
        if (!funcName) { findFunctions(child); continue; }
        paramsNode = findChildByType(child, "formal_parameters", "parameters");
        bodyNode = findChildByType(child, "statement_block", "block", "expression");
      }

      if (funcName) {
        const params = extractParamsFromNode(paramsNode);
        const returnType = returnTypeNode ? extractReturnTypeFromNode(returnTypeNode) : "";
        const summary = getSummary(ownerName ? `${ownerName}.${funcName}` : funcName, child, bodyNode, params, returnType);
        const signature = getSignature(funcName, params, returnType, language);
        const kind = detectNodeKind(funcName, relativePath, language, isMethod);
        const displayName = ownerName ? `${ownerName}.${funcName}` : funcName;
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

        findCallExpressions(child, nodeId, language, relativePath);
      }

      findFunctions(child, ownerName, ownerId);
    }
  };

  const findClasses = (node: SyntaxNode) => {
    for (const child of node.namedChildren) {
      let className = "";
      let parentClass = "";

      if (child.type === "class_declaration" || child.type === "class_specifier" || child.type === "struct_specifier") {
        const nameNode = findChildByType(child, "type_identifier", "identifier");
        if (!nameNode) { findClasses(child); continue; }
        className = nameNode.text;

        const heritage = findChildByType(child, "class_heritage", "base_class_clause");
        if (heritage) {
          const parentName = findChildByType(heritage, "type_identifier", "identifier");
          if (parentName) parentClass = parentName.text;
        }

        const superClass = findChildByType(child, "superclasses");
        if (superClass) {
          const argList = findChildByType(superClass, "argument_list");
          if (argList) {
            const parentId = findChildByType(argList, "identifier", "type_identifier");
            if (parentId) parentClass = parentId.text;
          }
        }

        const summary = getSummary(className, child, null, [], "");
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

        if (parentClass) {
          inheritEdges.push({ fromId: classId, toName: parentClass });
        }

        findFunctions(child, className, classId);
      } else if (child.type === "type_declaration") {
        const declarator = findChildByType(child, "type_identifier");
        const structType = findChildByType(child, "struct_type");
        if (declarator && structType) {
          className = declarator.text;
          const summary = getSummary(className, child, null, [], "");
          const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);

          nodes.push({
            nodeId: classId,
            kind: "class",
            name: className,
            summary,
            path: relativePath,
            signature: `type ${className} struct`,
            sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }]
          });

          symbolIndex.set(`${relativePath}::${className}`, classId);
          findFunctions(child, className, classId);
        }
      } else if (child.type === "struct_item" || child.type === "impl_item") {
        const nameNode = findChildByType(child, "type_identifier");
        if (!nameNode) { findClasses(child); continue; }
        className = nameNode.text;

        const summary = getSummary(className, child, null, [], "");
        const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);

        nodes.push({
          nodeId: classId,
          kind: "class",
          name: className,
          summary,
          path: relativePath,
          signature: child.type === "impl_item" ? `impl ${className}` : `struct ${className}`,
          sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }]
        });

        symbolIndex.set(`${relativePath}::${className}`, classId);
        findFunctions(child, className, classId);
      }

      findClasses(child);
    }
  };

  const findImports = (node: SyntaxNode) => {
    for (const child of node.namedChildren) {
      let importPath = "";

      if (child.type === "import_statement" || child.type === "import_declaration") {
        if (child.type === "import_statement") {
          const stringNode = findChildByType(child, "string");
          if (stringNode) importPath = stringNode.text.replace(/^["']|["']$/g, "");
        } else {
          const specList = findChildByType(child, "import_spec_list");
          if (specList) {
            for (const spec of specList.namedChildren) {
              if (spec.type === "import_spec") {
                const pathNode = findChildByType(spec, "interpreted_string_literal", "string_literal", "string");
                if (pathNode) importPath = pathNode.text.replace(/^["']|["']$/g, "");
              }
            }
          } else {
            const specNode = findChildByType(child, "import_spec");
            if (specNode) {
              const pathNode = findChildByType(specNode, "interpreted_string_literal", "string_literal", "string");
              if (pathNode) importPath = pathNode.text.replace(/^["']|["']$/g, "");
            }
          }
        }
      } else if (child.type === "preproc_include") {
        const pathNode = findChildByType(child, "system_lib_string", "string_literal", "string");
        if (pathNode) importPath = pathNode.text.replace(/^<|>$/g, "").replace(/^["']|["']$/g, "");
      } else if (child.type === "import_from_statement") {
        const modNode = findChildByType(child, "dotted_name", "identifier");
        if (modNode) importPath = modNode.text;
      } else if (child.type === "import_statement" && language === "python") {
        const dottedNode = findChildByType(child, "dotted_name", "aliased_import", "identifier");
        if (dottedNode) importPath = dottedNode.text;
      } else if (child.type === "use_declaration") {
        const argNode = child.namedChild(0);
        if (argNode) importPath = argNode.text;
      }

      if (importPath) {
        importEdges.push({ fromModuleId: moduleId, importPath });
      }

      findImports(child);
    }
  };

  const findCallExpressions = (node: SyntaxNode, callerId: string, lang: SupportedLanguage, relPath: string) => {
    for (const child of node.namedChildren) {
      let calleeName = "";

      if (child.type === "call_expression" || child.type === "call") {
        const funcNode = child.namedChild(0);
        if (funcNode) {
          if (funcNode.type === "identifier" || funcNode.type === "variable_identifier") {
            calleeName = funcNode.text;
          } else if (funcNode.type === "member_expression" || funcNode.type === "selector_expression" || funcNode.type === "field_expression" || funcNode.type === "attribute") {
            const propNode = findChildByType(funcNode, "property_identifier", "field_identifier", "identifier");
            if (propNode) calleeName = propNode.text;
          } else if (funcNode.type === "scoped_identifier" || funcNode.type === "qualified_identifier") {
            const nameNode = findChildByType(funcNode, "identifier", "field_identifier");
            if (nameNode) calleeName = nameNode.text;
          }
        }
      } else if (child.type === "method_invocation" || child.type === "call_expression") {
        const objNode = child.namedChild(0);
        if (objNode) {
          const methodNode = findChildByType(objNode, "property_identifier", "field_identifier", "identifier");
          if (methodNode) calleeName = methodNode.text;
        }
      }

      if (calleeName) {
        callEdges.push({ fromId: callerId, toName: calleeName, callText: child.text });
      }

      findCallExpressions(child, callerId, lang, relPath);
    }
  };

  findFunctions(tree.rootNode);
  findClasses(tree.rootNode);
  findImports(tree.rootNode);

  return { nodes, edges, symbolIndex, callEdges, importEdges, inheritEdges };
};
