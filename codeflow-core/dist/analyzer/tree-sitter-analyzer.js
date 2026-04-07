import { createNodeId } from "../internal/utils.js";
import { getLanguageFromPath, createParser } from "./tree-sitter-loader.js";
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const namedChildren = (node) => {
    if (!node)
        return [];
    return node.namedChildren.filter((c) => c !== null);
};
const extractCommentText = (node) => {
    const comments = [];
    let sibling = node.previousNamedSibling;
    while (sibling) {
        if (sibling.type.includes("comment") || sibling.type.includes("block_comment") || sibling.type.includes("line_comment")) {
            const text = sibling.text
                .replace(/^(\/\/|\/\*|\*|#)/g, "")
                .replace(/(\*\/|\*|\n)/g, " ")
                .trim();
            if (text)
                comments.unshift(text);
            sibling = sibling.previousNamedSibling;
        }
        else {
            break;
        }
    }
    return comments.join(" ").trim();
};
const extractPythonDocstring = (bodyNode) => {
    if (!bodyNode)
        return "";
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
const buildSummary = (name, node, bodyNode, params, returnType) => {
    const comment = extractCommentText(node);
    if (comment)
        return comment.split("\n")[0].trim();
    const docstring = extractPythonDocstring(bodyNode);
    if (docstring)
        return docstring;
    const paramPart = params.length > 0 ? ` that takes ${params.length} param${params.length > 1 ? "s" : ""}` : "";
    const returnPart = returnType && returnType !== "void" && returnType !== "unknown" && returnType !== "None"
        ? ` and returns ${returnType}`
        : "";
    return `${name}${paramPart}${returnPart}.`;
};
const buildSignature = (name, params, returnType, language) => {
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
const findChild = (node, ...types) => {
    if (!node)
        return null;
    for (const child of namedChildren(node)) {
        if (types.includes(child.type))
            return child;
    }
    return null;
};
const extractParams = (paramNode) => {
    if (!paramNode)
        return [];
    const params = [];
    const walk = (n) => {
        if (n.type === "parameter_declaration" || n.type === "typed_parameter" || n.type === "parameter") {
            let name = "";
            let type = "";
            for (const c of namedChildren(n)) {
                if (c.type === "identifier" || c.type === "variable_declarator")
                    name = c.text;
                else if (c.type === "type_identifier" || c.type === "primitive_type" || c.type === "sized_type_specifier")
                    type = c.text;
                else if (c.type === "type_annotation")
                    type = c.text.replace(/^:\s*/, "").trim();
            }
            const nameNode = n.childForFieldName("name") || n.childForFieldName("pattern");
            if (nameNode && !name)
                name = nameNode.text;
            const typeNode = n.childForFieldName("type");
            if (typeNode && !type)
                type = typeNode.text;
            if (name)
                params.push({ name, type: type || "unknown" });
            return;
        }
        for (const c of namedChildren(n))
            walk(c);
    };
    walk(paramNode);
    return params;
};
const extractReturnType = (returnNode) => {
    if (!returnNode)
        return "";
    const typeNode = returnNode.childForFieldName("type")
        || returnNode.childForFieldName("value")
        || returnNode.namedChild(0);
    if (typeNode)
        return typeNode.text.replace(/^\(|\)$/g, "").trim();
    return returnNode.text.replace(/^\(|\)$/g, "").trim() || "";
};
const detectKind = (name, relativePath, language) => {
    if (language === "typescript" || language === "javascript") {
        const baseName = relativePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
        if (baseName === "route" && HTTP_METHODS.has(name))
            return "api";
        if (baseName === "page" && name.toLowerCase().includes("page"))
            return "ui-screen";
    }
    return "function";
};
export const extractNodesFromFile = async (filePath, relativePath) => {
    const language = getLanguageFromPath(filePath);
    if (!language) {
        return { nodes: [], edges: [], symbolIndex: new Map(), callEdges: [], importEdges: [], inheritEdges: [] };
    }
    const parser = await createParser(language);
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(filePath, "utf-8");
    const tree = parser.parse(source);
    // Clean up parser instance after use
    parser.delete();
    if (!tree) {
        return { nodes: [], edges: [], symbolIndex: new Map(), callEdges: [], importEdges: [], inheritEdges: [] };
    }
    try {
        const root = tree.rootNode;
        const nodes = [];
        const edges = [];
        const symbolIndex = new Map();
        const callEdges = [];
        const importEdges = [];
        const inheritEdges = [];
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
        const recordFunc = (funcName, funcNode, paramsNode, returnTypeNode, bodyNode, ownerName, ownerId) => {
            if (!funcName)
                return;
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
            // Only store fully-qualified keys for methods to avoid collisions
            symbolIndex.set(`${relativePath}::${displayName}`, nodeId);
            if (!isMethod) {
                symbolIndex.set(`${relativePath}::${funcName}`, nodeId);
            }
            collectCalls(funcNode, nodeId);
        };
        const collectCalls = (node, callerId) => {
            for (const child of namedChildren(node)) {
                let calleeName = "";
                if (child.type === "call_expression" || child.type === "call") {
                    const funcNode = child.namedChild(0);
                    if (funcNode) {
                        if (funcNode.type === "identifier" || funcNode.type === "variable_identifier") {
                            calleeName = funcNode.text;
                        }
                        else if (funcNode.type === "member_expression" || funcNode.type === "selector_expression" || funcNode.type === "field_expression" || funcNode.type === "attribute") {
                            const propNode = findChild(funcNode, "property_identifier", "field_identifier", "identifier");
                            if (propNode)
                                calleeName = propNode.text;
                        }
                        else if (funcNode.type === "scoped_identifier" || funcNode.type === "qualified_identifier") {
                            const nameNode = findChild(funcNode, "identifier", "field_identifier");
                            if (nameNode)
                                calleeName = nameNode.text;
                        }
                    }
                }
                if (calleeName) {
                    callEdges.push({ fromId: callerId, toName: calleeName, callText: child.text });
                }
                collectCalls(child, callerId);
            }
        };
        const findFuncName = (node) => {
            // Direct identifier child
            const direct = findChild(node, "identifier");
            if (direct)
                return direct;
            // C/C++: function_declarator -> identifier (no pointer)
            const fnDecl = findChild(node, "function_declarator");
            if (fnDecl) {
                const id = findChild(fnDecl, "identifier", "field_identifier");
                if (id)
                    return id;
            }
            // C/C++: pointer_declarator -> function_declarator -> identifier
            const ptrDecl = findChild(node, "pointer_declarator", "array_declarator", "fn_pointer");
            if (ptrDecl) {
                const innerFnDecl = findChild(ptrDecl, "function_declarator") || findChild(ptrDecl, "declarator");
                if (innerFnDecl) {
                    return findChild(innerFnDecl, "identifier") || findChild(innerFnDecl, "field_identifier");
                }
                for (const c of namedChildren(ptrDecl)) {
                    if (c.type === "function_declarator")
                        return findChild(c, "identifier");
                    if (c.type === "identifier")
                        return c;
                }
            }
            return null;
        };
        const findParamsNode = (node) => {
            const direct = findChild(node, "parameter_list", "parameters", "formal_parameters");
            if (direct)
                return direct;
            // C/C++: inside function_declarator
            const fnDecl = findChild(node, "function_declarator");
            if (fnDecl)
                return findChild(fnDecl, "parameter_list");
            return null;
        };
        const findReturnTypeInfo = (node) => {
            let returnTypeNode = null;
            let bodyNode = null;
            bodyNode = findChild(node, "block", "statement_block", "compound_statement");
            // Go: result node
            const resultNode = findChild(node, "result");
            if (resultNode) {
                returnTypeNode = findChild(resultNode, "type_identifier", "primitive_type", "sized_type_specifier", "tuple_type", "generic_type", "pointer_type", "array_type");
            }
            // C/C++: primitive_type is a direct child (return type before function name)
            const primType = findChild(node, "primitive_type", "sized_type_specifier");
            if (primType)
                returnTypeNode = primType;
            // TS: type_annotation child
            if (!returnTypeNode) {
                const retNode = findChild(node, "type_annotation");
                if (retNode) {
                    returnTypeNode = findChild(retNode, "type_identifier", "primitive_type", "predefined_type") || retNode;
                }
            }
            // Rust: look for -> pattern
            if (!returnTypeNode) {
                for (let i = 0; i < node.namedChildren.length - 1; i++) {
                    const n = node.namedChildren[i];
                    if (n && n.type === "->" && node.namedChildren[i + 1]) {
                        returnTypeNode = node.namedChildren[i + 1];
                        break;
                    }
                }
            }
            return { returnTypeNode, bodyNode };
        };
        const walkFunctions = (node, parentOwnerName, parentOwnerId) => {
            for (const child of namedChildren(node)) {
                let funcName = "";
                let paramsNode = null;
                let returnTypeNode = null;
                let bodyNode = null;
                let isMethod = false;
                let currentOwnerName = parentOwnerName;
                let currentOwnerId = parentOwnerId;
                // Skip functions inside class bodies when at root level (handled by walkClasses instead)
                // But process them when walkClasses passes owner context
                const grandParent = child.parent?.parent;
                const greatGrandParent = child.parent?.parent?.parent;
                const isInsideClassBody = !parentOwnerName && (grandParent?.type === "class_definition" || grandParent?.type === "class_declaration" ||
                    grandParent?.type === "class_specifier" || grandParent?.type === "struct_specifier" ||
                    greatGrandParent?.type === "impl_item");
                if (child.type === "function_declaration" && !isInsideClassBody) {
                    const nameNode = findChild(child, "identifier");
                    if (nameNode) {
                        funcName = nameNode.text;
                        paramsNode = findChild(child, "parameter_list", "formal_parameters");
                        const { returnTypeNode: rt, bodyNode: bd } = findReturnTypeInfo(child);
                        returnTypeNode = rt;
                        bodyNode = bd;
                    }
                    else {
                        walkFunctions(child, currentOwnerName, currentOwnerId);
                        continue;
                    }
                }
                else if (child.type === "function_definition" && !isInsideClassBody) {
                    const nameNode = findFuncName(child);
                    if (nameNode) {
                        funcName = nameNode.text;
                        paramsNode = findParamsNode(child);
                        const { returnTypeNode: rt, bodyNode: bd } = findReturnTypeInfo(child);
                        returnTypeNode = rt;
                        bodyNode = bd;
                        if (currentOwnerName)
                            isMethod = true;
                    }
                    else {
                        walkFunctions(child, currentOwnerName, currentOwnerId);
                        continue;
                    }
                }
                else if (child.type === "method_declaration") {
                    funcName = findChild(child, "field_identifier")?.text || "";
                    paramsNode = findChild(child, "parameter_list", "parameters");
                    const resultNode = findChild(child, "result");
                    if (resultNode) {
                        returnTypeNode = findChild(resultNode, "type_identifier", "primitive_type", "sized_type_specifier", "tuple_type", "generic_type", "pointer_type", "array_type");
                    }
                    bodyNode = findChild(child, "block");
                    isMethod = true;
                    // Go: extract receiver type from first parameter_list (the receiver)
                    const recvParam = child.namedChildren[0];
                    if (recvParam && recvParam.type === "parameter_list") {
                        const recvDecl = recvParam.namedChildren[0];
                        if (recvDecl) {
                            const recvTypeNode = recvDecl.childForFieldName("type");
                            if (recvTypeNode) {
                                // Handle *Type -> Type
                                let typeName = recvTypeNode.text;
                                if (typeName.startsWith("*"))
                                    typeName = typeName.substring(1);
                                currentOwnerName = typeName;
                                // Find the matching class node id
                                const classKey = `${relativePath}::${typeName}`;
                                currentOwnerId = symbolIndex.get(classKey);
                            }
                        }
                    }
                }
                else if (child.type === "method_definition" && !isInsideClassBody) {
                    const nameNode = findChild(child, "identifier", "property_identifier");
                    if (nameNode) {
                        funcName = nameNode.text;
                        paramsNode = findChild(child, "parameters", "formal_parameters");
                        const { returnTypeNode: rt, bodyNode: bd } = findReturnTypeInfo(child);
                        returnTypeNode = rt;
                        bodyNode = bd;
                        isMethod = true;
                        currentOwnerName = parentOwnerName;
                        currentOwnerId = parentOwnerId;
                    }
                }
                else if (child.type === "function_item" && !isInsideClassBody) {
                    const nameNode = findChild(child, "identifier");
                    if (nameNode) {
                        funcName = nameNode.text;
                        paramsNode = findChild(child, "parameters");
                        const { returnTypeNode: rt, bodyNode: bd } = findReturnTypeInfo(child);
                        returnTypeNode = rt;
                        bodyNode = bd;
                    }
                    else {
                        walkFunctions(child, currentOwnerName, currentOwnerId);
                        continue;
                    }
                }
                else if (child.type === "arrow_function" || child.type === "function_expression") {
                    const parent = child.parent;
                    if (parent?.type === "variable_declarator") {
                        const nameN = findChild(parent, "identifier");
                        if (nameN)
                            funcName = nameN.text;
                    }
                    if (!funcName) {
                        walkFunctions(child, currentOwnerName, currentOwnerId);
                        continue;
                    }
                    paramsNode = findChild(child, "formal_parameters", "parameters");
                    bodyNode = findChild(child, "statement_block", "block", "expression");
                }
                if (funcName) {
                    recordFunc(funcName, child, paramsNode, returnTypeNode, bodyNode, currentOwnerName, currentOwnerId);
                }
                walkFunctions(child, currentOwnerName, currentOwnerId);
            }
        };
        const walkClasses = (node) => {
            for (const child of namedChildren(node)) {
                let className = "";
                let parentClass = "";
                // TS/JS: class_declaration, C++: class_specifier/struct_specifier
                if (child.type === "class_declaration" || child.type === "class_specifier" || child.type === "struct_specifier") {
                    const nameNode = findChild(child, "type_identifier", "identifier");
                    if (!nameNode) {
                        walkClasses(child);
                        continue;
                    }
                    className = nameNode.text;
                    const heritage = findChild(child, "class_heritage", "base_class_clause");
                    if (heritage) {
                        // TS: class_heritage -> extends_clause -> identifier
                        const parentNode = findChild(heritage, "type_identifier", "identifier");
                        if (parentNode) {
                            parentClass = parentNode.text;
                        }
                        else {
                            // Deeper search
                            for (const h of namedChildren(heritage)) {
                                const p = findChild(h, "type_identifier", "identifier");
                                if (p) {
                                    parentClass = p.text;
                                    break;
                                }
                            }
                        }
                    }
                    const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
                    nodes.push({
                        nodeId: classId,
                        kind: "class",
                        name: className,
                        summary: buildSummary(className, child, null, [], ""),
                        path: relativePath,
                        signature: `class ${className}`,
                        sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }],
                        ownerId: moduleId
                    });
                    symbolIndex.set(`${relativePath}::${className}`, classId);
                    if (parentClass)
                        inheritEdges.push({ fromId: classId, toName: parentClass });
                    walkFunctions(child, className, classId);
                }
                // Python: class_definition
                else if (child.type === "class_definition") {
                    const nameNode = findChild(child, "identifier");
                    if (!nameNode) {
                        walkClasses(child);
                        continue;
                    }
                    className = nameNode.text;
                    // Python inheritance: argument_list directly under class_definition
                    // (some grammars wrap in superclasses, others don't)
                    const argList = findChild(child, "argument_list", "superclasses");
                    if (argList) {
                        const parentId = findChild(argList, "identifier", "type_identifier");
                        if (parentId)
                            parentClass = parentId.text;
                    }
                    const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
                    nodes.push({
                        nodeId: classId,
                        kind: "class",
                        name: className,
                        summary: buildSummary(className, child, null, [], ""),
                        path: relativePath,
                        signature: `class ${className}`,
                        sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }],
                        ownerId: moduleId
                    });
                    symbolIndex.set(`${relativePath}::${className}`, classId);
                    if (parentClass)
                        inheritEdges.push({ fromId: classId, toName: parentClass });
                    walkFunctions(child, className, classId);
                }
                // Go: type_declaration -> type_spec -> type_identifier + struct_type
                else if (child.type === "type_declaration") {
                    const typeSpec = findChild(child, "type_spec");
                    if (typeSpec) {
                        const structType = findChild(typeSpec, "struct_type");
                        const nameNode = findChild(typeSpec, "type_identifier");
                        if (nameNode && structType) {
                            className = nameNode.text;
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
                    }
                }
                // Rust: struct_item, impl_item
                else if (child.type === "struct_item") {
                    const nameNode = findChild(child, "type_identifier");
                    if (!nameNode) {
                        walkClasses(child);
                        continue;
                    }
                    className = nameNode.text;
                    const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
                    nodes.push({
                        nodeId: classId,
                        kind: "class",
                        name: className,
                        summary: buildSummary(className, child, null, [], ""),
                        path: relativePath,
                        signature: `struct ${className}`,
                        sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }]
                    });
                    symbolIndex.set(`${relativePath}::${className}`, classId);
                    walkFunctions(child, className, classId);
                }
                else if (child.type === "impl_item") {
                    const nameNode = findChild(child, "type_identifier");
                    if (!nameNode) {
                        walkClasses(child);
                        continue;
                    }
                    className = nameNode.text;
                    // Check if struct node already exists
                    const existingId = symbolIndex.get(`${relativePath}::${className}`);
                    if (existingId) {
                        // Use existing node ID and just walk functions
                        walkFunctions(child, className, existingId);
                    }
                    else {
                        // Create new node if struct doesn't exist
                        const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
                        nodes.push({
                            nodeId: classId,
                            kind: "class",
                            name: className,
                            summary: buildSummary(className, child, null, [], ""),
                            path: relativePath,
                            signature: `impl ${className}`,
                            sourceRefs: [{ kind: "repo", path: relativePath, symbol: className }]
                        });
                        symbolIndex.set(`${relativePath}::${className}`, classId);
                        walkFunctions(child, className, classId);
                    }
                }
                walkClasses(child);
            }
        };
        const walkImports = (node) => {
            for (const child of namedChildren(node)) {
                let importPath = "";
                if (child.type === "import_statement") {
                    const stringNode = findChild(child, "string");
                    if (stringNode)
                        importPath = stringNode.text.replace(/^["']|["']$/g, "");
                }
                else if (child.type === "import_declaration") {
                    const specList = findChild(child, "import_spec_list");
                    if (specList) {
                        for (const spec of namedChildren(specList)) {
                            if (spec.type === "import_spec") {
                                const pathNode = findChild(spec, "interpreted_string_literal", "string_literal", "string");
                                if (pathNode)
                                    importPath = pathNode.text.replace(/^["']|["']$/g, "");
                            }
                        }
                    }
                    else {
                        const specNode = findChild(child, "import_spec");
                        if (specNode) {
                            const pathNode = findChild(specNode, "interpreted_string_literal", "string_literal", "string");
                            if (pathNode)
                                importPath = pathNode.text.replace(/^["']|["']$/g, "");
                        }
                    }
                }
                else if (child.type === "preproc_include") {
                    const pathNode = findChild(child, "system_lib_string", "string_literal", "string");
                    if (pathNode)
                        importPath = pathNode.text.replace(/^<|>$/g, "").replace(/^["']|["']$/g, "");
                }
                else if (child.type === "import_from_statement") {
                    const modNode = findChild(child, "dotted_name", "identifier");
                    if (modNode)
                        importPath = modNode.text;
                }
                else if (child.type === "use_declaration") {
                    const argNode = child.namedChild(0);
                    if (argNode)
                        importPath = argNode.text;
                }
                if (importPath) {
                    importEdges.push({ fromModuleId: moduleId, importPath });
                }
                walkImports(child);
            }
        };
        walkClasses(root);
        walkFunctions(root);
        walkImports(root);
        return { nodes, edges, symbolIndex, callEdges, importEdges, inheritEdges };
    }
    finally {
        // Clean up syntax tree
        tree.delete();
    }
};
