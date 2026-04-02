import fs from "node:fs/promises";
import path from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";
import { emptyContract } from "../schema/index.js";
import { createNode, createNodeId, dedupeEdges, mergeContracts, mergeDesignCalls, toPosixPath } from "../internal/utils.js";
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const EXCLUDED_SEGMENTS = ["/node_modules/", "/.next/", "/dist/", "/artifacts/", "/coverage/"];
const hasJsDocSummary = (node) => {
    const maybeJsDocNode = node;
    return maybeJsDocNode.getJsDocs
        ? maybeJsDocNode
            .getJsDocs()
            .map((doc) => doc.getDescription().trim())
            .filter(Boolean)
            .join(" ")
        : "";
};
const buildSummary = (name, fallback) => fallback || `Blueprint node for ${name}.`;
const getCallableSignatureNode = (declaration) => {
    if (Node.isVariableDeclaration(declaration)) {
        return (declaration.getInitializerIfKind(SyntaxKind.ArrowFunction) ??
            declaration.getInitializerIfKind(SyntaxKind.FunctionExpression));
    }
    return declaration;
};
const createContractFromCallable = (summary, declaration) => {
    const signatureNode = getCallableSignatureNode(declaration);
    if (!signatureNode || !("getParameters" in signatureNode) || !("getReturnType" in signatureNode)) {
        return mergeContracts(emptyContract(), {
            ...emptyContract(),
            summary,
            responsibilities: [summary]
        });
    }
    const callableNode = signatureNode;
    const parameters = callableNode.getParameters().map((parameter) => ({
        name: parameter.getName(),
        type: parameter.getType().getText()
    }));
    const returnType = callableNode.getReturnType().getText(signatureNode);
    return mergeContracts(emptyContract(), {
        ...emptyContract(),
        summary,
        responsibilities: [summary],
        inputs: parameters,
        outputs: [{ name: "result", type: returnType }]
    });
};
const createMethodSpecFromDeclaration = (summary, declaration, name, signature) => {
    const callableContract = createContractFromCallable(summary, declaration);
    return {
        name,
        signature,
        summary,
        inputs: callableContract.inputs,
        outputs: callableContract.outputs,
        sideEffects: callableContract.sideEffects,
        calls: callableContract.calls
    };
};
const createClassContract = (summary, classDeclaration) => mergeContracts(emptyContract(), {
    ...emptyContract(),
    summary,
    responsibilities: [summary],
    attributes: classDeclaration.getProperties().map((property) => ({
        name: property.getName(),
        type: property.getType().getText(property),
        description: hasJsDocSummary(property) || undefined
    })),
    methods: classDeclaration.getMethods().map((method) => createMethodSpecFromDeclaration(buildSummary(`${classDeclaration.getName()}.${method.getName()}`, hasJsDocSummary(method)), method, method.getName(), `${method.getName()}(${method
        .getParameters()
        .map((parameter) => `${parameter.getName()}: ${parameter.getType().getText(parameter)}`)
        .join(", ")}): ${method.getReturnType().getText(method)}`))
});
const toRelativePath = (repoPath, filePath) => toPosixPath(path.relative(repoPath, filePath));
const isIncludedFile = (repoPath, filePath) => {
    const normalized = toPosixPath(filePath);
    return normalized.startsWith(toPosixPath(repoPath)) && !EXCLUDED_SEGMENTS.some((segment) => normalized.includes(segment));
};
const buildRoutePath = (relativePath) => {
    const normalized = relativePath.replace(/^src\//, "");
    const match = normalized.match(/app\/api\/(.+)\/route\.(ts|tsx|js|jsx)$/);
    if (!match) {
        return normalized;
    }
    return `/api/${match[1].replace(/\/index$/, "")}`;
};
const buildScreenName = (relativePath) => {
    const normalized = relativePath.replace(/^src\//, "");
    const match = normalized.match(/app\/(.+)\/page\.(ts|tsx|js|jsx)$/);
    if (!match) {
        return "Home Screen";
    }
    const routePath = `/${match[1].replace(/\/index$/, "")}`;
    return routePath === "/" ? "Home Screen" : `${routePath} Screen`;
};
const createSymbolKey = (relativePath, symbolName, ownerName) => `${relativePath}::${ownerName ? `${ownerName}.` : ""}${symbolName}`;
const getAliasedSymbol = (node) => {
    const symbol = node.getSymbol();
    return symbol?.getAliasedSymbol() ?? symbol;
};
const getDeclarationKey = (repoPath, declaration) => {
    const sourceFile = declaration.getSourceFile();
    const relativePath = toRelativePath(repoPath, sourceFile.getFilePath());
    if (Node.isMethodDeclaration(declaration)) {
        const classDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
        const className = classDeclaration?.getName();
        if (!className) {
            return null;
        }
        return createSymbolKey(relativePath, declaration.getName(), className);
    }
    if (Node.isFunctionDeclaration(declaration) ||
        Node.isVariableDeclaration(declaration) ||
        Node.isClassDeclaration(declaration) ||
        Node.isFunctionExpression(declaration) ||
        Node.isArrowFunction(declaration)) {
        const name = "getName" in declaration && declaration.getName
            ? declaration.getName()
            : declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName();
        if (!name) {
            return null;
        }
        return createSymbolKey(relativePath, name);
    }
    return null;
};
const addModuleNode = (nodes, relativePath) => {
    const id = createNodeId("module", relativePath, relativePath);
    if (nodes.has(id)) {
        return id;
    }
    nodes.set(id, createNode({
        id,
        kind: "module",
        name: relativePath,
        path: relativePath,
        summary: `Source module ${relativePath}.`,
        contract: mergeContracts(emptyContract(), {
            ...emptyContract(),
            summary: `Source module ${relativePath}.`,
            responsibilities: [`Owns the source file ${relativePath}.`]
        }),
        sourceRefs: [
            {
                kind: "repo",
                path: relativePath
            }
        ]
    }));
    return id;
};
const collectVariableFunctions = (sourceFile) => sourceFile.getVariableDeclarations().filter((declaration) => {
    return Boolean(getCallableSignatureNode(declaration));
});
export const analyzeTypeScriptRepo = async (repoPath) => {
    const repoStats = await fs.stat(repoPath).catch(() => null);
    if (!repoStats?.isDirectory()) {
        throw new Error(`Repo path does not exist or is not a directory: ${repoPath}`);
    }
    const tsconfigPath = path.join(repoPath, "tsconfig.json");
    const hasTsconfig = await fs
        .stat(tsconfigPath)
        .then((stats) => stats.isFile())
        .catch(() => false);
    const project = hasTsconfig
        ? new Project({
            tsConfigFilePath: tsconfigPath,
            skipAddingFilesFromTsConfig: false
        })
        : new Project({
            compilerOptions: {
                allowJs: true,
                jsx: 4
            }
        });
    if (!hasTsconfig) {
        project.addSourceFilesAtPaths([
            path.join(repoPath, "**/*.ts"),
            path.join(repoPath, "**/*.tsx"),
            path.join(repoPath, "**/*.js"),
            path.join(repoPath, "**/*.jsx")
        ]);
    }
    const sourceFiles = project
        .getSourceFiles()
        .filter((sourceFile) => isIncludedFile(repoPath, sourceFile.getFilePath()));
    const warnings = [];
    if (sourceFiles.length === 0) {
        warnings.push(`No TypeScript or JavaScript source files found under ${repoPath}.`);
    }
    const nodes = new Map();
    const edges = [];
    const symbolToNodeId = new Map();
    const callableEntries = [];
    for (const sourceFile of sourceFiles) {
        const relativePath = toRelativePath(repoPath, sourceFile.getFilePath());
        const moduleId = addModuleNode(nodes, relativePath);
        for (const importDeclaration of sourceFile.getImportDeclarations()) {
            const target = importDeclaration.getModuleSpecifierSourceFile();
            if (!target || !isIncludedFile(repoPath, target.getFilePath())) {
                continue;
            }
            edges.push({
                from: moduleId,
                to: addModuleNode(nodes, toRelativePath(repoPath, target.getFilePath())),
                kind: "imports",
                label: importDeclaration.getModuleSpecifierValue(),
                required: true,
                confidence: 1
            });
        }
        const classes = sourceFile.getClasses().filter((declaration) => declaration.getName());
        for (const classDeclaration of classes) {
            const className = classDeclaration.getNameOrThrow();
            const classId = createNodeId("class", `${relativePath}:${className}`, `${relativePath}:${className}`);
            const summary = buildSummary(className, hasJsDocSummary(classDeclaration));
            nodes.set(classId, createNode({
                id: classId,
                kind: "class",
                name: className,
                path: relativePath,
                ownerId: moduleId,
                summary,
                signature: `class ${className}`,
                contract: createClassContract(summary, classDeclaration),
                sourceRefs: [
                    {
                        kind: "repo",
                        path: relativePath,
                        symbol: className
                    }
                ]
            }));
            symbolToNodeId.set(createSymbolKey(relativePath, className), classId);
            const heritage = classDeclaration.getExtends();
            if (heritage) {
                const parentSymbol = getAliasedSymbol(heritage.getExpression());
                const parentDeclaration = parentSymbol?.getDeclarations()[0];
                const declarationKey = parentDeclaration ? getDeclarationKey(repoPath, parentDeclaration) : null;
                const parentId = declarationKey ? symbolToNodeId.get(declarationKey) : undefined;
                if (parentId) {
                    edges.push({
                        from: classId,
                        to: parentId,
                        kind: "inherits",
                        required: true,
                        confidence: 0.95
                    });
                }
            }
            for (const method of classDeclaration.getMethods()) {
                const summary = buildSummary(`${className}.${method.getName()}`, hasJsDocSummary(method));
                const nodeId = createNodeId("function", `${relativePath}:${className}.${method.getName()}`, `${relativePath}:${className}.${method.getName()}`);
                const methodSignature = `${method.getName()}(${method
                    .getParameters()
                    .map((parameter) => `${parameter.getName()}: ${parameter.getType().getText(parameter)}`)
                    .join(", ")}): ${method.getReturnType().getText(method)}`;
                nodes.set(nodeId, createNode({
                    id: nodeId,
                    kind: "function",
                    name: `${className}.${method.getName()}`,
                    path: relativePath,
                    ownerId: classId,
                    summary,
                    signature: methodSignature,
                    contract: createContractFromCallable(summary, method),
                    sourceRefs: [
                        {
                            kind: "repo",
                            path: relativePath,
                            symbol: `${className}.${method.getName()}`
                        }
                    ]
                }));
                symbolToNodeId.set(createSymbolKey(relativePath, method.getName(), className), nodeId);
                callableEntries.push({
                    nodeId,
                    declaration: method,
                    relativePath,
                    symbolName: method.getName(),
                    ownerName: className
                });
            }
        }
        for (const functionDeclaration of sourceFile.getFunctions().filter((declaration) => declaration.getName())) {
            const functionName = functionDeclaration.getNameOrThrow();
            const summary = buildSummary(functionName, hasJsDocSummary(functionDeclaration));
            const isApiRoute = sourceFile.getBaseNameWithoutExtension() === "route" && HTTP_METHODS.has(functionName);
            const isPageFile = sourceFile.getBaseNameWithoutExtension() === "page" && functionName.toLowerCase().includes("page");
            const kind = isApiRoute ? "api" : isPageFile ? "ui-screen" : "function";
            const nodeName = isApiRoute
                ? `${functionName} ${buildRoutePath(relativePath)}`
                : isPageFile
                    ? buildScreenName(relativePath)
                    : functionName;
            const nodeId = createNodeId(kind, `${relativePath}:${nodeName}`, `${relativePath}:${nodeName}`);
            const signature = `${functionName}(${functionDeclaration
                .getParameters()
                .map((parameter) => `${parameter.getName()}: ${parameter.getType().getText(parameter)}`)
                .join(", ")}): ${functionDeclaration.getReturnType().getText(functionDeclaration)}`;
            nodes.set(nodeId, createNode({
                id: nodeId,
                kind,
                name: nodeName,
                path: relativePath,
                ownerId: kind === "function" ? moduleId : undefined,
                summary,
                signature,
                contract: createContractFromCallable(summary, functionDeclaration),
                sourceRefs: [
                    {
                        kind: "repo",
                        path: relativePath,
                        symbol: functionName
                    }
                ]
            }));
            symbolToNodeId.set(createSymbolKey(relativePath, functionName), nodeId);
            callableEntries.push({
                nodeId,
                declaration: functionDeclaration,
                relativePath,
                symbolName: functionName
            });
        }
        for (const variableDeclaration of collectVariableFunctions(sourceFile)) {
            const symbolName = variableDeclaration.getName();
            const summary = buildSummary(symbolName, hasJsDocSummary(variableDeclaration.getVariableStatement() ?? variableDeclaration));
            const nodeId = createNodeId("function", `${relativePath}:${symbolName}`, `${relativePath}:${symbolName}`);
            const initializer = variableDeclaration.getInitializer();
            if (!initializer || (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))) {
                continue;
            }
            const signature = `${symbolName}(${initializer
                .getParameters()
                .map((parameter) => `${parameter.getName()}: ${parameter.getType().getText(parameter)}`)
                .join(", ")}): ${initializer.getReturnType().getText(initializer)}`;
            nodes.set(nodeId, createNode({
                id: nodeId,
                kind: "function",
                name: symbolName,
                path: relativePath,
                ownerId: moduleId,
                summary,
                signature,
                contract: createContractFromCallable(summary, variableDeclaration),
                sourceRefs: [
                    {
                        kind: "repo",
                        path: relativePath,
                        symbol: symbolName
                    }
                ]
            }));
            symbolToNodeId.set(createSymbolKey(relativePath, symbolName), nodeId);
            callableEntries.push({
                nodeId,
                declaration: variableDeclaration,
                relativePath,
                symbolName
            });
        }
    }
    const callableNodeIdsByClassId = new Map();
    for (const node of nodes.values()) {
        if (node.kind === "function" && node.ownerId) {
            const owned = callableNodeIdsByClassId.get(node.ownerId) ?? [];
            owned.push(node.id);
            callableNodeIdsByClassId.set(node.ownerId, owned);
        }
    }
    for (const entry of callableEntries) {
        const scope = getCallableSignatureNode(entry.declaration);
        if (!scope) {
            continue;
        }
        for (const callExpression of scope.getDescendantsOfKind(SyntaxKind.CallExpression)) {
            const expression = callExpression.getExpression();
            const targetSymbol = getAliasedSymbol(expression);
            const targetDeclaration = targetSymbol?.getDeclarations()[0];
            const targetKey = targetDeclaration ? getDeclarationKey(repoPath, targetDeclaration) : null;
            const targetNodeId = targetKey ? symbolToNodeId.get(targetKey) : undefined;
            if (!targetNodeId || targetNodeId === entry.nodeId) {
                continue;
            }
            const targetNode = nodes.get(targetNodeId);
            edges.push({
                from: entry.nodeId,
                to: targetNodeId,
                kind: "calls",
                label: expression.getText(),
                required: true,
                confidence: 0.9
            });
            const caller = nodes.get(entry.nodeId);
            if (caller && targetNode) {
                nodes.set(entry.nodeId, {
                    ...caller,
                    contract: mergeContracts(caller.contract, {
                        ...emptyContract(),
                        calls: [
                            {
                                target: targetNode.name,
                                kind: "calls",
                                description: expression.getText()
                            }
                        ],
                        dependencies: [targetNode.name]
                    })
                });
            }
        }
    }
    for (const node of nodes.values()) {
        if (node.kind !== "class") {
            continue;
        }
        const ownedMethodIds = callableNodeIdsByClassId.get(node.id) ?? [];
        if (!ownedMethodIds.length || !node.contract.methods.length) {
            continue;
        }
        const methods = node.contract.methods.map((methodSpec) => {
            const ownedMethodNode = ownedMethodIds
                .map((methodId) => nodes.get(methodId))
                .find((methodNode) => methodNode?.name.split(".").pop() === methodSpec.name);
            if (!ownedMethodNode) {
                return methodSpec;
            }
            return {
                ...methodSpec,
                sideEffects: [...new Set([...methodSpec.sideEffects, ...ownedMethodNode.contract.sideEffects])],
                calls: mergeDesignCalls(methodSpec.calls, ownedMethodNode.contract.calls)
            };
        });
        nodes.set(node.id, {
            ...node,
            contract: {
                ...node.contract,
                methods,
                dependencies: [...new Set([...node.contract.dependencies, ...methods.flatMap((method) => method.calls.map((call) => call.target))])]
            }
        });
    }
    return {
        nodes: [...nodes.values()],
        edges: dedupeEdges(edges),
        workflows: [],
        warnings
    };
};
