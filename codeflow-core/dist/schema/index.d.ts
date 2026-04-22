import { z } from "zod";
export declare const fileChangeSchema: z.ZodObject<{
    file: z.ZodString;
    action: z.ZodEnum<{
        created: "created";
        modified: "modified";
        deleted: "deleted";
        renamed: "renamed";
    }>;
    summary: z.ZodString;
}, z.core.$strip>;
export type FileChange = z.infer<typeof fileChangeSchema>;
export declare const taskTypeSchema: z.ZodEnum<{
    code_generation: "code_generation";
    refactor: "refactor";
    bugfix: "bugfix";
    test_generation: "test_generation";
    documentation: "documentation";
    unknown: "unknown";
}>;
export type TaskType = z.infer<typeof taskTypeSchema>;
export declare const executionModeSchema: z.ZodEnum<{
    essential: "essential";
    yolo: "yolo";
}>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;
export declare const blueprintPhaseSchema: z.ZodEnum<{
    spec: "spec";
    implementation: "implementation";
    integration: "integration";
}>;
export type BlueprintPhase = z.infer<typeof blueprintPhaseSchema>;
export declare const nodeStatusSchema: z.ZodEnum<{
    spec_only: "spec_only";
    implemented: "implemented";
    verified: "verified";
    connected: "connected";
}>;
export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export declare const nodeKindSchema: z.ZodEnum<{
    function: "function";
    module: "module";
    api: "api";
    class: "class";
    "ui-screen": "ui-screen";
}>;
export type BlueprintNodeKind = z.infer<typeof nodeKindSchema>;
export declare const edgeKindSchema: z.ZodEnum<{
    imports: "imports";
    calls: "calls";
    inherits: "inherits";
    renders: "renders";
    emits: "emits";
    consumes: "consumes";
    "reads-state": "reads-state";
    "writes-state": "writes-state";
}>;
export type BlueprintEdgeKind = z.infer<typeof edgeKindSchema>;
export declare const traceStatusSchema: z.ZodEnum<{
    error: "error";
    idle: "idle";
    success: "success";
    warning: "warning";
}>;
export type TraceStatus = z.infer<typeof traceStatusSchema>;
export declare const outputProvenanceSchema: z.ZodEnum<{
    deterministic: "deterministic";
    ai: "ai";
    heuristic: "heuristic";
    simulated: "simulated";
    observed: "observed";
}>;
export type OutputProvenance = z.infer<typeof outputProvenanceSchema>;
export declare const featureMaturitySchema: z.ZodEnum<{
    production: "production";
    preview: "preview";
    experimental: "experimental";
    scaffold: "scaffold";
}>;
export type FeatureMaturity = z.infer<typeof featureMaturitySchema>;
export declare const contractFieldSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ContractField = z.infer<typeof contractFieldSchema>;
export declare const designCallSchema: z.ZodObject<{
    target: z.ZodString;
    kind: z.ZodOptional<z.ZodEnum<{
        imports: "imports";
        calls: "calls";
        inherits: "inherits";
        renders: "renders";
        emits: "emits";
        consumes: "consumes";
        "reads-state": "reads-state";
        "writes-state": "writes-state";
    }>>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DesignCall = z.infer<typeof designCallSchema>;
export declare const methodSpecSchema: z.ZodObject<{
    name: z.ZodString;
    signature: z.ZodOptional<z.ZodString>;
    summary: z.ZodString;
    inputs: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    outputs: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    sideEffects: z.ZodArray<z.ZodString>;
    calls: z.ZodArray<z.ZodObject<{
        target: z.ZodString;
        kind: z.ZodOptional<z.ZodEnum<{
            imports: "imports";
            calls: "calls";
            inherits: "inherits";
            renders: "renders";
            emits: "emits";
            consumes: "consumes";
            "reads-state": "reads-state";
            "writes-state": "writes-state";
        }>>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MethodSpec = z.infer<typeof methodSpecSchema>;
export declare const codeContractSchema: z.ZodObject<{
    summary: z.ZodString;
    responsibilities: z.ZodArray<z.ZodString>;
    inputs: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    outputs: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    attributes: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    methods: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        signature: z.ZodOptional<z.ZodString>;
        summary: z.ZodString;
        inputs: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        outputs: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        sideEffects: z.ZodArray<z.ZodString>;
        calls: z.ZodArray<z.ZodObject<{
            target: z.ZodString;
            kind: z.ZodOptional<z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    sideEffects: z.ZodArray<z.ZodString>;
    errors: z.ZodArray<z.ZodString>;
    dependencies: z.ZodArray<z.ZodString>;
    calls: z.ZodArray<z.ZodObject<{
        target: z.ZodString;
        kind: z.ZodOptional<z.ZodEnum<{
            imports: "imports";
            calls: "calls";
            inherits: "inherits";
            renders: "renders";
            emits: "emits";
            consumes: "consumes";
            "reads-state": "reads-state";
            "writes-state": "writes-state";
        }>>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    uiAccess: z.ZodArray<z.ZodString>;
    backendAccess: z.ZodArray<z.ZodString>;
    notes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type CodeContract = z.infer<typeof codeContractSchema>;
export declare const sourceRefSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        prd: "prd";
        repo: "repo";
        generated: "generated";
        trace: "trace";
    }>;
    path: z.ZodOptional<z.ZodString>;
    symbol: z.ZodOptional<z.ZodString>;
    section: z.ZodOptional<z.ZodString>;
    detail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export declare const traceStateSchema: z.ZodObject<{
    status: z.ZodEnum<{
        error: "error";
        idle: "idle";
        success: "success";
        warning: "warning";
    }>;
    count: z.ZodNumber;
    errors: z.ZodNumber;
    totalDurationMs: z.ZodNumber;
    lastSpanIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type TraceState = z.infer<typeof traceStateSchema>;
export declare const nodeVerificationSchema: z.ZodObject<{
    verifiedAt: z.ZodString;
    status: z.ZodEnum<{
        success: "success";
        failure: "failure";
    }>;
    stdout: z.ZodString;
    stderr: z.ZodString;
    exitCode: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type NodeVerification = z.infer<typeof nodeVerificationSchema>;
export declare const mcpToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    inputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type McpTool = z.infer<typeof mcpToolSchema>;
export declare const mcpServerConfigSchema: z.ZodObject<{
    serverUrl: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    headersRef: z.ZodOptional<z.ZodString>;
    enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export declare const mcpToolResultContentSchema: z.ZodObject<{
    type: z.ZodString;
    text: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type McpToolResultContent = z.infer<typeof mcpToolResultContentSchema>;
export declare const mcpToolResultSchema: z.ZodObject<{
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    isError: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type McpToolResult = z.infer<typeof mcpToolResultSchema>;
export declare const blueprintNodeSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        function: "function";
        module: "module";
        api: "api";
        class: "class";
        "ui-screen": "ui-screen";
    }>;
    name: z.ZodString;
    summary: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    ownerId: z.ZodOptional<z.ZodString>;
    signature: z.ZodOptional<z.ZodString>;
    contract: z.ZodObject<{
        summary: z.ZodString;
        responsibilities: z.ZodArray<z.ZodString>;
        inputs: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        outputs: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        attributes: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        methods: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            signature: z.ZodOptional<z.ZodString>;
            summary: z.ZodString;
            inputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            outputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            sideEffects: z.ZodArray<z.ZodString>;
            calls: z.ZodArray<z.ZodObject<{
                target: z.ZodString;
                kind: z.ZodOptional<z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    inherits: "inherits";
                    renders: "renders";
                    emits: "emits";
                    consumes: "consumes";
                    "reads-state": "reads-state";
                    "writes-state": "writes-state";
                }>>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        sideEffects: z.ZodArray<z.ZodString>;
        errors: z.ZodArray<z.ZodString>;
        dependencies: z.ZodArray<z.ZodString>;
        calls: z.ZodArray<z.ZodObject<{
            target: z.ZodString;
            kind: z.ZodOptional<z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        uiAccess: z.ZodArray<z.ZodString>;
        backendAccess: z.ZodArray<z.ZodString>;
        notes: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    sourceRefs: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            prd: "prd";
            repo: "repo";
            generated: "generated";
            trace: "trace";
        }>;
        path: z.ZodOptional<z.ZodString>;
        symbol: z.ZodOptional<z.ZodString>;
        section: z.ZodOptional<z.ZodString>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    generatedRefs: z.ZodArray<z.ZodString>;
    traceRefs: z.ZodArray<z.ZodString>;
    traceState: z.ZodOptional<z.ZodObject<{
        status: z.ZodEnum<{
            error: "error";
            idle: "idle";
            success: "success";
            warning: "warning";
        }>;
        count: z.ZodNumber;
        errors: z.ZodNumber;
        totalDurationMs: z.ZodNumber;
        lastSpanIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodDefault<z.ZodEnum<{
        spec_only: "spec_only";
        implemented: "implemented";
        verified: "verified";
        connected: "connected";
    }>>;
    specDraft: z.ZodOptional<z.ZodString>;
    implementationDraft: z.ZodOptional<z.ZodString>;
    lastVerification: z.ZodOptional<z.ZodObject<{
        verifiedAt: z.ZodString;
        status: z.ZodEnum<{
            success: "success";
            failure: "failure";
        }>;
        stdout: z.ZodString;
        stderr: z.ZodString;
        exitCode: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        serverUrl: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        headersRef: z.ZodOptional<z.ZodString>;
        enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type BlueprintNode = z.input<typeof blueprintNodeSchema>;
export type MaterializedBlueprintNode = z.infer<typeof blueprintNodeSchema>;
export declare const blueprintEdgeSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    kind: z.ZodEnum<{
        imports: "imports";
        calls: "calls";
        inherits: "inherits";
        renders: "renders";
        emits: "emits";
        consumes: "consumes";
        "reads-state": "reads-state";
        "writes-state": "writes-state";
    }>;
    label: z.ZodOptional<z.ZodString>;
    required: z.ZodBoolean;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export type BlueprintEdge = z.infer<typeof blueprintEdgeSchema>;
export declare const workflowPathSchema: z.ZodObject<{
    name: z.ZodString;
    steps: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type WorkflowPath = z.infer<typeof workflowPathSchema>;
export declare const blueprintGraphSchema: z.ZodObject<{
    projectName: z.ZodString;
    mode: z.ZodEnum<{
        essential: "essential";
        yolo: "yolo";
    }>;
    phase: z.ZodDefault<z.ZodEnum<{
        spec: "spec";
        implementation: "implementation";
        integration: "integration";
    }>>;
    generatedAt: z.ZodString;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            module: "module";
            api: "api";
            class: "class";
            "ui-screen": "ui-screen";
        }>;
        name: z.ZodString;
        summary: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
        signature: z.ZodOptional<z.ZodString>;
        contract: z.ZodObject<{
            summary: z.ZodString;
            responsibilities: z.ZodArray<z.ZodString>;
            inputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            outputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            attributes: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            methods: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                signature: z.ZodOptional<z.ZodString>;
                summary: z.ZodString;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            sideEffects: z.ZodArray<z.ZodString>;
            errors: z.ZodArray<z.ZodString>;
            dependencies: z.ZodArray<z.ZodString>;
            calls: z.ZodArray<z.ZodObject<{
                target: z.ZodString;
                kind: z.ZodOptional<z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    inherits: "inherits";
                    renders: "renders";
                    emits: "emits";
                    consumes: "consumes";
                    "reads-state": "reads-state";
                    "writes-state": "writes-state";
                }>>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            uiAccess: z.ZodArray<z.ZodString>;
            backendAccess: z.ZodArray<z.ZodString>;
            notes: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        sourceRefs: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                prd: "prd";
                repo: "repo";
                generated: "generated";
                trace: "trace";
            }>;
            path: z.ZodOptional<z.ZodString>;
            symbol: z.ZodOptional<z.ZodString>;
            section: z.ZodOptional<z.ZodString>;
            detail: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        generatedRefs: z.ZodArray<z.ZodString>;
        traceRefs: z.ZodArray<z.ZodString>;
        traceState: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                error: "error";
                idle: "idle";
                success: "success";
                warning: "warning";
            }>;
            count: z.ZodNumber;
            errors: z.ZodNumber;
            totalDurationMs: z.ZodNumber;
            lastSpanIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodDefault<z.ZodEnum<{
            spec_only: "spec_only";
            implemented: "implemented";
            verified: "verified";
            connected: "connected";
        }>>;
        specDraft: z.ZodOptional<z.ZodString>;
        implementationDraft: z.ZodOptional<z.ZodString>;
        lastVerification: z.ZodOptional<z.ZodObject<{
            verifiedAt: z.ZodString;
            status: z.ZodEnum<{
                success: "success";
                failure: "failure";
            }>;
            stdout: z.ZodString;
            stderr: z.ZodString;
            exitCode: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            serverUrl: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            headersRef: z.ZodOptional<z.ZodString>;
            enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    edges: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        kind: z.ZodEnum<{
            imports: "imports";
            calls: "calls";
            inherits: "inherits";
            renders: "renders";
            emits: "emits";
            consumes: "consumes";
            "reads-state": "reads-state";
            "writes-state": "writes-state";
        }>;
        label: z.ZodOptional<z.ZodString>;
        required: z.ZodBoolean;
        confidence: z.ZodNumber;
    }, z.core.$strip>>;
    workflows: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        steps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    warnings: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type BlueprintGraph = z.input<typeof blueprintGraphSchema>;
export type MaterializedBlueprintGraph = z.infer<typeof blueprintGraphSchema>;
export declare const executionTaskSchema: z.ZodObject<{
    id: z.ZodString;
    nodeId: z.ZodString;
    title: z.ZodString;
    kind: z.ZodEnum<{
        function: "function";
        module: "module";
        api: "api";
        class: "class";
        "ui-screen": "ui-screen";
    }>;
    dependsOn: z.ZodArray<z.ZodString>;
    ownerPath: z.ZodOptional<z.ZodString>;
    batchIndex: z.ZodNumber;
}, z.core.$strip>;
export type ExecutionTask = z.infer<typeof executionTaskSchema>;
export declare const executionBatchSchema: z.ZodObject<{
    index: z.ZodNumber;
    taskIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ExecutionBatch = z.infer<typeof executionBatchSchema>;
export declare const executionTaskStatusSchema: z.ZodEnum<{
    pending: "pending";
    completed: "completed";
    skipped: "skipped";
    blocked: "blocked";
}>;
export type ExecutionTaskStatus = z.infer<typeof executionTaskStatusSchema>;
export declare const executionStepKindSchema: z.ZodEnum<{
    node: "node";
    method: "method";
    edge: "edge";
    test: "test";
}>;
export type ExecutionStepKind = z.infer<typeof executionStepKindSchema>;
export declare const executionStepStatusSchema: z.ZodEnum<{
    warning: "warning";
    pending: "pending";
    skipped: "skipped";
    blocked: "blocked";
    running: "running";
    passed: "passed";
    failed: "failed";
}>;
export type ExecutionStepStatus = z.infer<typeof executionStepStatusSchema>;
export declare const contractCheckStageSchema: z.ZodEnum<{
    output: "output";
    input: "input";
    test: "test";
    handoff: "handoff";
    "side-effect": "side-effect";
}>;
export type ContractCheckStage = z.infer<typeof contractCheckStageSchema>;
export declare const contractCheckSchema: z.ZodObject<{
    stage: z.ZodEnum<{
        output: "output";
        input: "input";
        test: "test";
        handoff: "handoff";
        "side-effect": "side-effect";
    }>;
    status: z.ZodEnum<{
        warning: "warning";
        skipped: "skipped";
        passed: "passed";
        failed: "failed";
    }>;
    expected: z.ZodOptional<z.ZodString>;
    actualPreview: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
}, z.core.$strip>;
export type ContractCheck = z.infer<typeof contractCheckSchema>;
export declare const executionArtifactSchema: z.ZodObject<{
    id: z.ZodString;
    sourceNodeId: z.ZodString;
    targetNodeId: z.ZodOptional<z.ZodString>;
    edgeId: z.ZodOptional<z.ZodString>;
    declaredType: z.ZodOptional<z.ZodString>;
    actualType: z.ZodOptional<z.ZodString>;
    preview: z.ZodString;
    serializedValue: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ExecutionArtifact = z.infer<typeof executionArtifactSchema>;
export declare const executionStepSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    taskId: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<{
        node: "node";
        method: "method";
        edge: "edge";
        test: "test";
    }>;
    nodeId: z.ZodString;
    parentNodeId: z.ZodOptional<z.ZodString>;
    methodName: z.ZodOptional<z.ZodString>;
    edgeId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        warning: "warning";
        pending: "pending";
        skipped: "skipped";
        blocked: "blocked";
        running: "running";
        passed: "passed";
        failed: "failed";
    }>;
    startedAt: z.ZodString;
    completedAt: z.ZodString;
    durationMs: z.ZodNumber;
    stdout: z.ZodDefault<z.ZodString>;
    stderr: z.ZodDefault<z.ZodString>;
    message: z.ZodString;
    blockedByStepId: z.ZodOptional<z.ZodString>;
    inputPreview: z.ZodOptional<z.ZodString>;
    outputPreview: z.ZodOptional<z.ZodString>;
    artifactIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    contractChecks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        stage: z.ZodEnum<{
            output: "output";
            input: "input";
            test: "test";
            handoff: "handoff";
            "side-effect": "side-effect";
        }>;
        status: z.ZodEnum<{
            warning: "warning";
            skipped: "skipped";
            passed: "passed";
            failed: "failed";
        }>;
        expected: z.ZodOptional<z.ZodString>;
        actualPreview: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ExecutionStep = z.infer<typeof executionStepSchema>;
export declare const executionSummarySchema: z.ZodObject<{
    passed: z.ZodNumber;
    failed: z.ZodNumber;
    blocked: z.ZodNumber;
    skipped: z.ZodNumber;
    warning: z.ZodNumber;
}, z.core.$strip>;
export type ExecutionSummary = z.infer<typeof executionSummarySchema>;
export declare const runtimeTestCaseSchema: z.ZodObject<{
    id: z.ZodString;
    nodeId: z.ZodString;
    title: z.ZodString;
    kind: z.ZodEnum<{
        "happy-path": "happy-path";
        "edge-case": "edge-case";
        "invalid-input": "invalid-input";
    }>;
    input: z.ZodString;
    expectation: z.ZodEnum<{
        warning: "warning";
        pass: "pass";
        fail: "fail";
    }>;
    notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type RuntimeTestCase = z.infer<typeof runtimeTestCaseSchema>;
export declare const runtimeTestResultSchema: z.ZodObject<{
    caseId: z.ZodString;
    title: z.ZodString;
    kind: z.ZodEnum<{
        "happy-path": "happy-path";
        "edge-case": "edge-case";
        "invalid-input": "invalid-input";
    }>;
    status: z.ZodEnum<{
        warning: "warning";
        pending: "pending";
        skipped: "skipped";
        blocked: "blocked";
        running: "running";
        passed: "passed";
        failed: "failed";
    }>;
    message: z.ZodString;
    stepIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type RuntimeTestResult = z.infer<typeof runtimeTestResultSchema>;
export declare const runPlanSchema: z.ZodObject<{
    generatedAt: z.ZodString;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nodeId: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            module: "module";
            api: "api";
            class: "class";
            "ui-screen": "ui-screen";
        }>;
        dependsOn: z.ZodArray<z.ZodString>;
        ownerPath: z.ZodOptional<z.ZodString>;
        batchIndex: z.ZodNumber;
    }, z.core.$strip>>;
    batches: z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        taskIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    warnings: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type RunPlan = z.infer<typeof runPlanSchema>;
export declare const taskExecutionResultSchema: z.ZodObject<{
    taskId: z.ZodString;
    nodeId: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        completed: "completed";
        skipped: "skipped";
        blocked: "blocked";
    }>;
    batchIndex: z.ZodNumber;
    outputPaths: z.ZodArray<z.ZodString>;
    managedRegionIds: z.ZodArray<z.ZodString>;
    message: z.ZodString;
    errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
    taskType: z.ZodDefault<z.ZodEnum<{
        code_generation: "code_generation";
        refactor: "refactor";
        bugfix: "bugfix";
        test_generation: "test_generation";
        documentation: "documentation";
        unknown: "unknown";
    }>>;
    reasoning: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        action: z.ZodEnum<{
            created: "created";
            modified: "modified";
            deleted: "deleted";
            renamed: "renamed";
        }>;
        summary: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TaskExecutionResult = z.infer<typeof taskExecutionResultSchema>;
export declare const ownershipRecordSchema: z.ZodObject<{
    path: z.ZodString;
    nodeId: z.ZodString;
    managedRegionIds: z.ZodArray<z.ZodString>;
    generatedAt: z.ZodString;
}, z.core.$strip>;
export type OwnershipRecord = z.infer<typeof ownershipRecordSchema>;
export declare const executionReportSchema: z.ZodObject<{
    startedAt: z.ZodString;
    completedAt: z.ZodString;
    results: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        nodeId: z.ZodString;
        status: z.ZodEnum<{
            pending: "pending";
            completed: "completed";
            skipped: "skipped";
            blocked: "blocked";
        }>;
        batchIndex: z.ZodNumber;
        outputPaths: z.ZodArray<z.ZodString>;
        managedRegionIds: z.ZodArray<z.ZodString>;
        message: z.ZodString;
        errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
        taskType: z.ZodDefault<z.ZodEnum<{
            code_generation: "code_generation";
            refactor: "refactor";
            bugfix: "bugfix";
            test_generation: "test_generation";
            documentation: "documentation";
            unknown: "unknown";
        }>>;
        reasoning: z.ZodString;
        changes: z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            action: z.ZodEnum<{
                created: "created";
                modified: "modified";
                deleted: "deleted";
                renamed: "renamed";
            }>;
            summary: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    ownership: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        nodeId: z.ZodString;
        managedRegionIds: z.ZodArray<z.ZodString>;
        generatedAt: z.ZodString;
    }, z.core.$strip>>;
    steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        runId: z.ZodString;
        taskId: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            node: "node";
            method: "method";
            edge: "edge";
            test: "test";
        }>;
        nodeId: z.ZodString;
        parentNodeId: z.ZodOptional<z.ZodString>;
        methodName: z.ZodOptional<z.ZodString>;
        edgeId: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            warning: "warning";
            pending: "pending";
            skipped: "skipped";
            blocked: "blocked";
            running: "running";
            passed: "passed";
            failed: "failed";
        }>;
        startedAt: z.ZodString;
        completedAt: z.ZodString;
        durationMs: z.ZodNumber;
        stdout: z.ZodDefault<z.ZodString>;
        stderr: z.ZodDefault<z.ZodString>;
        message: z.ZodString;
        blockedByStepId: z.ZodOptional<z.ZodString>;
        inputPreview: z.ZodOptional<z.ZodString>;
        outputPreview: z.ZodOptional<z.ZodString>;
        artifactIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        contractChecks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            stage: z.ZodEnum<{
                output: "output";
                input: "input";
                test: "test";
                handoff: "handoff";
                "side-effect": "side-effect";
            }>;
            status: z.ZodEnum<{
                warning: "warning";
                skipped: "skipped";
                passed: "passed";
                failed: "failed";
            }>;
            expected: z.ZodOptional<z.ZodString>;
            actualPreview: z.ZodOptional<z.ZodString>;
            message: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceNodeId: z.ZodString;
        targetNodeId: z.ZodOptional<z.ZodString>;
        edgeId: z.ZodOptional<z.ZodString>;
        declaredType: z.ZodOptional<z.ZodString>;
        actualType: z.ZodOptional<z.ZodString>;
        preview: z.ZodString;
        serializedValue: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    summary: z.ZodOptional<z.ZodObject<{
        passed: z.ZodNumber;
        failed: z.ZodNumber;
        blocked: z.ZodNumber;
        skipped: z.ZodNumber;
        warning: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ExecutionReport = z.infer<typeof executionReportSchema>;
export declare const riskFactorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    score: z.ZodNumber;
}, z.core.$strip>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
export declare const riskReportSchema: z.ZodObject<{
    score: z.ZodNumber;
    level: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    requiresApproval: z.ZodBoolean;
    factors: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        score: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RiskReport = z.infer<typeof riskReportSchema>;
export declare const approvalRecordSchema: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodEnum<{
        export: "export";
    }>;
    projectName: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
    }>;
    fingerprint: z.ZodString;
    requestedAt: z.ZodString;
    approvedAt: z.ZodOptional<z.ZodString>;
    outputDir: z.ZodString;
    runPlan: z.ZodObject<{
        generatedAt: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            nodeId: z.ZodString;
            title: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            dependsOn: z.ZodArray<z.ZodString>;
            ownerPath: z.ZodOptional<z.ZodString>;
            batchIndex: z.ZodNumber;
        }, z.core.$strip>>;
        batches: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            taskIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    riskReport: z.ZodObject<{
        score: z.ZodNumber;
        level: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        requiresApproval: z.ZodBoolean;
        factors: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            score: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
export declare const artifactValidationStateSchema: z.ZodEnum<{
    scaffold: "scaffold";
    validated: "validated";
    draft: "draft";
}>;
export type ArtifactValidationState = z.infer<typeof artifactValidationStateSchema>;
export declare const exportArtifactSchema: z.ZodObject<{
    nodeId: z.ZodOptional<z.ZodString>;
    nodeName: z.ZodOptional<z.ZodString>;
    nodeKind: z.ZodOptional<z.ZodEnum<{
        function: "function";
        module: "module";
        api: "api";
        class: "class";
        "ui-screen": "ui-screen";
    }>>;
    relativePath: z.ZodString;
    artifactType: z.ZodEnum<{
        documentation: "documentation";
        integration: "integration";
        ownership: "ownership";
        code: "code";
        blueprint: "blueprint";
        canvas: "canvas";
    }>;
    validationState: z.ZodEnum<{
        scaffold: "scaffold";
        validated: "validated";
        draft: "draft";
    }>;
    provenance: z.ZodEnum<{
        deterministic: "deterministic";
        ai: "ai";
        heuristic: "heuristic";
        simulated: "simulated";
        observed: "observed";
    }>;
    maturity: z.ZodEnum<{
        production: "production";
        preview: "preview";
        experimental: "experimental";
        scaffold: "scaffold";
    }>;
    generatedAt: z.ZodString;
    notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type ExportArtifact = z.infer<typeof exportArtifactSchema>;
export declare const exportResultSchema: z.ZodObject<{
    rootDir: z.ZodString;
    blueprintPath: z.ZodString;
    canvasPath: z.ZodString;
    docsDir: z.ZodString;
    stubsDir: z.ZodString;
    artifactManifestPath: z.ZodOptional<z.ZodString>;
    artifactSummary: z.ZodOptional<z.ZodObject<{
        total: z.ZodNumber;
        validated: z.ZodNumber;
        draft: z.ZodNumber;
        scaffold: z.ZodNumber;
    }, z.core.$strip>>;
    phaseManifestPath: z.ZodOptional<z.ZodString>;
    integrationEntrypointPath: z.ZodOptional<z.ZodString>;
    ownershipPath: z.ZodOptional<z.ZodString>;
    obsidianIndexPath: z.ZodOptional<z.ZodString>;
    diffPath: z.ZodOptional<z.ZodString>;
    sandboxDir: z.ZodOptional<z.ZodString>;
    checkpointDir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ExportResult = z.infer<typeof exportResultSchema>;
export declare const persistedSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    projectName: z.ZodString;
    updatedAt: z.ZodString;
    repoPath: z.ZodOptional<z.ZodString>;
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    runPlan: z.ZodObject<{
        generatedAt: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            nodeId: z.ZodString;
            title: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            dependsOn: z.ZodArray<z.ZodString>;
            ownerPath: z.ZodOptional<z.ZodString>;
            batchIndex: z.ZodNumber;
        }, z.core.$strip>>;
        batches: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            taskIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    lastRiskReport: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        level: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        requiresApproval: z.ZodBoolean;
        factors: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            score: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    lastExportResult: z.ZodOptional<z.ZodObject<{
        rootDir: z.ZodString;
        blueprintPath: z.ZodString;
        canvasPath: z.ZodString;
        docsDir: z.ZodString;
        stubsDir: z.ZodString;
        artifactManifestPath: z.ZodOptional<z.ZodString>;
        artifactSummary: z.ZodOptional<z.ZodObject<{
            total: z.ZodNumber;
            validated: z.ZodNumber;
            draft: z.ZodNumber;
            scaffold: z.ZodNumber;
        }, z.core.$strip>>;
        phaseManifestPath: z.ZodOptional<z.ZodString>;
        integrationEntrypointPath: z.ZodOptional<z.ZodString>;
        ownershipPath: z.ZodOptional<z.ZodString>;
        obsidianIndexPath: z.ZodOptional<z.ZodString>;
        diffPath: z.ZodOptional<z.ZodString>;
        sandboxDir: z.ZodOptional<z.ZodString>;
        checkpointDir: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    lastExecutionReport: z.ZodOptional<z.ZodObject<{
        startedAt: z.ZodString;
        completedAt: z.ZodString;
        results: z.ZodArray<z.ZodObject<{
            taskId: z.ZodString;
            nodeId: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                completed: "completed";
                skipped: "skipped";
                blocked: "blocked";
            }>;
            batchIndex: z.ZodNumber;
            outputPaths: z.ZodArray<z.ZodString>;
            managedRegionIds: z.ZodArray<z.ZodString>;
            message: z.ZodString;
            errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
            taskType: z.ZodDefault<z.ZodEnum<{
                code_generation: "code_generation";
                refactor: "refactor";
                bugfix: "bugfix";
                test_generation: "test_generation";
                documentation: "documentation";
                unknown: "unknown";
            }>>;
            reasoning: z.ZodString;
            changes: z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                action: z.ZodEnum<{
                    created: "created";
                    modified: "modified";
                    deleted: "deleted";
                    renamed: "renamed";
                }>;
                summary: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        ownership: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            nodeId: z.ZodString;
            managedRegionIds: z.ZodArray<z.ZodString>;
            generatedAt: z.ZodString;
        }, z.core.$strip>>;
        steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            runId: z.ZodString;
            taskId: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                node: "node";
                method: "method";
                edge: "edge";
                test: "test";
            }>;
            nodeId: z.ZodString;
            parentNodeId: z.ZodOptional<z.ZodString>;
            methodName: z.ZodOptional<z.ZodString>;
            edgeId: z.ZodOptional<z.ZodString>;
            status: z.ZodEnum<{
                warning: "warning";
                pending: "pending";
                skipped: "skipped";
                blocked: "blocked";
                running: "running";
                passed: "passed";
                failed: "failed";
            }>;
            startedAt: z.ZodString;
            completedAt: z.ZodString;
            durationMs: z.ZodNumber;
            stdout: z.ZodDefault<z.ZodString>;
            stderr: z.ZodDefault<z.ZodString>;
            message: z.ZodString;
            blockedByStepId: z.ZodOptional<z.ZodString>;
            inputPreview: z.ZodOptional<z.ZodString>;
            outputPreview: z.ZodOptional<z.ZodString>;
            artifactIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            contractChecks: z.ZodDefault<z.ZodArray<z.ZodObject<{
                stage: z.ZodEnum<{
                    output: "output";
                    input: "input";
                    test: "test";
                    handoff: "handoff";
                    "side-effect": "side-effect";
                }>;
                status: z.ZodEnum<{
                    warning: "warning";
                    skipped: "skipped";
                    passed: "passed";
                    failed: "failed";
                }>;
                expected: z.ZodOptional<z.ZodString>;
                actualPreview: z.ZodOptional<z.ZodString>;
                message: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sourceNodeId: z.ZodString;
            targetNodeId: z.ZodOptional<z.ZodString>;
            edgeId: z.ZodOptional<z.ZodString>;
            declaredType: z.ZodOptional<z.ZodString>;
            actualType: z.ZodOptional<z.ZodString>;
            preview: z.ZodString;
            serializedValue: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        summary: z.ZodOptional<z.ZodObject<{
            passed: z.ZodNumber;
            failed: z.ZodNumber;
            blocked: z.ZodNumber;
            skipped: z.ZodNumber;
            warning: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    approvalIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type PersistedSession = z.infer<typeof persistedSessionSchema>;
export declare const runRecordSchema: z.ZodObject<{
    schemaVersion: z.ZodDefault<z.ZodLiteral<"1.0">>;
    id: z.ZodString;
    projectName: z.ZodString;
    action: z.ZodEnum<{
        export: "export";
        build: "build";
    }>;
    createdAt: z.ZodString;
    runPlan: z.ZodObject<{
        generatedAt: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            nodeId: z.ZodString;
            title: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            dependsOn: z.ZodArray<z.ZodString>;
            ownerPath: z.ZodOptional<z.ZodString>;
            batchIndex: z.ZodNumber;
        }, z.core.$strip>>;
        batches: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            taskIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    riskReport: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        level: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        requiresApproval: z.ZodBoolean;
        factors: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            score: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    approvalId: z.ZodOptional<z.ZodString>;
    executionReport: z.ZodOptional<z.ZodObject<{
        startedAt: z.ZodString;
        completedAt: z.ZodString;
        results: z.ZodArray<z.ZodObject<{
            taskId: z.ZodString;
            nodeId: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                completed: "completed";
                skipped: "skipped";
                blocked: "blocked";
            }>;
            batchIndex: z.ZodNumber;
            outputPaths: z.ZodArray<z.ZodString>;
            managedRegionIds: z.ZodArray<z.ZodString>;
            message: z.ZodString;
            errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
            taskType: z.ZodDefault<z.ZodEnum<{
                code_generation: "code_generation";
                refactor: "refactor";
                bugfix: "bugfix";
                test_generation: "test_generation";
                documentation: "documentation";
                unknown: "unknown";
            }>>;
            reasoning: z.ZodString;
            changes: z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                action: z.ZodEnum<{
                    created: "created";
                    modified: "modified";
                    deleted: "deleted";
                    renamed: "renamed";
                }>;
                summary: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        ownership: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            nodeId: z.ZodString;
            managedRegionIds: z.ZodArray<z.ZodString>;
            generatedAt: z.ZodString;
        }, z.core.$strip>>;
        steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            runId: z.ZodString;
            taskId: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                node: "node";
                method: "method";
                edge: "edge";
                test: "test";
            }>;
            nodeId: z.ZodString;
            parentNodeId: z.ZodOptional<z.ZodString>;
            methodName: z.ZodOptional<z.ZodString>;
            edgeId: z.ZodOptional<z.ZodString>;
            status: z.ZodEnum<{
                warning: "warning";
                pending: "pending";
                skipped: "skipped";
                blocked: "blocked";
                running: "running";
                passed: "passed";
                failed: "failed";
            }>;
            startedAt: z.ZodString;
            completedAt: z.ZodString;
            durationMs: z.ZodNumber;
            stdout: z.ZodDefault<z.ZodString>;
            stderr: z.ZodDefault<z.ZodString>;
            message: z.ZodString;
            blockedByStepId: z.ZodOptional<z.ZodString>;
            inputPreview: z.ZodOptional<z.ZodString>;
            outputPreview: z.ZodOptional<z.ZodString>;
            artifactIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            contractChecks: z.ZodDefault<z.ZodArray<z.ZodObject<{
                stage: z.ZodEnum<{
                    output: "output";
                    input: "input";
                    test: "test";
                    handoff: "handoff";
                    "side-effect": "side-effect";
                }>;
                status: z.ZodEnum<{
                    warning: "warning";
                    skipped: "skipped";
                    passed: "passed";
                    failed: "failed";
                }>;
                expected: z.ZodOptional<z.ZodString>;
                actualPreview: z.ZodOptional<z.ZodString>;
                message: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sourceNodeId: z.ZodString;
            targetNodeId: z.ZodOptional<z.ZodString>;
            edgeId: z.ZodOptional<z.ZodString>;
            declaredType: z.ZodOptional<z.ZodString>;
            actualType: z.ZodOptional<z.ZodString>;
            preview: z.ZodString;
            serializedValue: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        summary: z.ZodOptional<z.ZodObject<{
            passed: z.ZodNumber;
            failed: z.ZodNumber;
            blocked: z.ZodNumber;
            skipped: z.ZodNumber;
            warning: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    exportResult: z.ZodOptional<z.ZodObject<{
        rootDir: z.ZodString;
        blueprintPath: z.ZodString;
        canvasPath: z.ZodString;
        docsDir: z.ZodString;
        stubsDir: z.ZodString;
        artifactManifestPath: z.ZodOptional<z.ZodString>;
        artifactSummary: z.ZodOptional<z.ZodObject<{
            total: z.ZodNumber;
            validated: z.ZodNumber;
            draft: z.ZodNumber;
            scaffold: z.ZodNumber;
        }, z.core.$strip>>;
        phaseManifestPath: z.ZodOptional<z.ZodString>;
        integrationEntrypointPath: z.ZodOptional<z.ZodString>;
        ownershipPath: z.ZodOptional<z.ZodString>;
        obsidianIndexPath: z.ZodOptional<z.ZodString>;
        diffPath: z.ZodOptional<z.ZodString>;
        sandboxDir: z.ZodOptional<z.ZodString>;
        checkpointDir: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export declare const traceSpanSchema: z.ZodObject<{
    spanId: z.ZodString;
    traceId: z.ZodString;
    name: z.ZodString;
    blueprintNodeId: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        error: "error";
        success: "success";
        warning: "warning";
    }>;
    durationMs: z.ZodNumber;
    runtime: z.ZodDefault<z.ZodString>;
    provenance: z.ZodDefault<z.ZodEnum<{
        deterministic: "deterministic";
        ai: "ai";
        heuristic: "heuristic";
        simulated: "simulated";
        observed: "observed";
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TraceSpan = z.input<typeof traceSpanSchema>;
export type MaterializedTraceSpan = z.infer<typeof traceSpanSchema>;
export declare const observabilityLogSchema: z.ZodObject<{
    id: z.ZodString;
    level: z.ZodEnum<{
        error: "error";
        debug: "debug";
        info: "info";
        warn: "warn";
    }>;
    message: z.ZodString;
    blueprintNodeId: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    runtime: z.ZodDefault<z.ZodString>;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type ObservabilityLog = z.infer<typeof observabilityLogSchema>;
export declare const observabilityIngestRequestSchema: z.ZodObject<{
    projectName: z.ZodString;
    spans: z.ZodDefault<z.ZodArray<z.ZodObject<{
        spanId: z.ZodString;
        traceId: z.ZodString;
        name: z.ZodString;
        blueprintNodeId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            error: "error";
            success: "success";
            warning: "warning";
        }>;
        durationMs: z.ZodNumber;
        runtime: z.ZodDefault<z.ZodString>;
        provenance: z.ZodDefault<z.ZodEnum<{
            deterministic: "deterministic";
            ai: "ai";
            heuristic: "heuristic";
            simulated: "simulated";
            observed: "observed";
        }>>;
        timestamp: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    logs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<{
            error: "error";
            debug: "debug";
            info: "info";
            warn: "warn";
        }>;
        message: z.ZodString;
        blueprintNodeId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        runtime: z.ZodDefault<z.ZodString>;
        timestamp: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ObservabilityIngestRequest = z.infer<typeof observabilityIngestRequestSchema>;
export declare const observabilitySnapshotSchema: z.ZodObject<{
    projectName: z.ZodString;
    updatedAt: z.ZodString;
    spans: z.ZodArray<z.ZodObject<{
        spanId: z.ZodString;
        traceId: z.ZodString;
        name: z.ZodString;
        blueprintNodeId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            error: "error";
            success: "success";
            warning: "warning";
        }>;
        durationMs: z.ZodNumber;
        runtime: z.ZodDefault<z.ZodString>;
        provenance: z.ZodDefault<z.ZodEnum<{
            deterministic: "deterministic";
            ai: "ai";
            heuristic: "heuristic";
            simulated: "simulated";
            observed: "observed";
        }>>;
        timestamp: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    logs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<{
            error: "error";
            debug: "debug";
            info: "info";
            warn: "warn";
        }>;
        message: z.ZodString;
        blueprintNodeId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        runtime: z.ZodDefault<z.ZodString>;
        timestamp: z.ZodString;
    }, z.core.$strip>>;
    graph: z.ZodOptional<z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ObservabilitySnapshot = z.infer<typeof observabilitySnapshotSchema>;
export declare const conflictKindSchema: z.ZodEnum<{
    "missing-in-repo": "missing-in-repo";
    "missing-in-blueprint": "missing-in-blueprint";
    "signature-mismatch": "signature-mismatch";
    "summary-mismatch": "summary-mismatch";
}>;
export type ConflictKind = z.infer<typeof conflictKindSchema>;
export declare const conflictRecordSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        "missing-in-repo": "missing-in-repo";
        "missing-in-blueprint": "missing-in-blueprint";
        "signature-mismatch": "signature-mismatch";
        "summary-mismatch": "summary-mismatch";
    }>;
    nodeId: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    blueprintValue: z.ZodOptional<z.ZodString>;
    repoValue: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    suggestedAction: z.ZodString;
}, z.core.$strip>;
export type ConflictRecord = z.infer<typeof conflictRecordSchema>;
export declare const conflictReportSchema: z.ZodObject<{
    checkedAt: z.ZodString;
    repoPath: z.ZodString;
    conflicts: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            "missing-in-repo": "missing-in-repo";
            "missing-in-blueprint": "missing-in-blueprint";
            "signature-mismatch": "signature-mismatch";
            "summary-mismatch": "summary-mismatch";
        }>;
        nodeId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        blueprintValue: z.ZodOptional<z.ZodString>;
        repoValue: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        suggestedAction: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConflictReport = z.infer<typeof conflictReportSchema>;
export declare const conflictCheckRequestSchema: z.ZodObject<{
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    repoPath: z.ZodString;
}, z.core.$strip>;
export type ConflictCheckRequest = z.infer<typeof conflictCheckRequestSchema>;
export declare const buildBlueprintRequestSchema: z.ZodObject<{
    projectName: z.ZodString;
    repoPath: z.ZodOptional<z.ZodString>;
    prdText: z.ZodOptional<z.ZodString>;
    mode: z.ZodEnum<{
        essential: "essential";
        yolo: "yolo";
    }>;
}, z.core.$strip>;
export type BuildBlueprintRequest = z.infer<typeof buildBlueprintRequestSchema>;
export declare const exportBlueprintRequestSchema: z.ZodObject<{
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    outputDir: z.ZodOptional<z.ZodString>;
    approvalId: z.ZodOptional<z.ZodString>;
    codeDrafts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type ExportBlueprintRequest = z.infer<typeof exportBlueprintRequestSchema>;
export declare const approvalActionRequestSchema: z.ZodObject<{
    approvalId: z.ZodString;
}, z.core.$strip>;
export type ApprovalActionRequest = z.infer<typeof approvalActionRequestSchema>;
export declare const runtimeExecutionRequestSchema: z.ZodObject<{
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    targetNodeId: z.ZodOptional<z.ZodString>;
    input: z.ZodString;
    codeDrafts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    includeGeneratedTests: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type RuntimeExecutionRequest = z.infer<typeof runtimeExecutionRequestSchema>;
export declare const runtimeExecutionResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    stdout: z.ZodString;
    stderr: z.ZodString;
    exitCode: z.ZodNullable<z.ZodNumber>;
    durationMs: z.ZodNumber;
    executedPath: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    entryNodeId: z.ZodOptional<z.ZodString>;
    steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        runId: z.ZodString;
        taskId: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            node: "node";
            method: "method";
            edge: "edge";
            test: "test";
        }>;
        nodeId: z.ZodString;
        parentNodeId: z.ZodOptional<z.ZodString>;
        methodName: z.ZodOptional<z.ZodString>;
        edgeId: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            warning: "warning";
            pending: "pending";
            skipped: "skipped";
            blocked: "blocked";
            running: "running";
            passed: "passed";
            failed: "failed";
        }>;
        startedAt: z.ZodString;
        completedAt: z.ZodString;
        durationMs: z.ZodNumber;
        stdout: z.ZodDefault<z.ZodString>;
        stderr: z.ZodDefault<z.ZodString>;
        message: z.ZodString;
        blockedByStepId: z.ZodOptional<z.ZodString>;
        inputPreview: z.ZodOptional<z.ZodString>;
        outputPreview: z.ZodOptional<z.ZodString>;
        artifactIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        contractChecks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            stage: z.ZodEnum<{
                output: "output";
                input: "input";
                test: "test";
                handoff: "handoff";
                "side-effect": "side-effect";
            }>;
            status: z.ZodEnum<{
                warning: "warning";
                skipped: "skipped";
                passed: "passed";
                failed: "failed";
            }>;
            expected: z.ZodOptional<z.ZodString>;
            actualPreview: z.ZodOptional<z.ZodString>;
            message: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceNodeId: z.ZodString;
        targetNodeId: z.ZodOptional<z.ZodString>;
        edgeId: z.ZodOptional<z.ZodString>;
        declaredType: z.ZodOptional<z.ZodString>;
        actualType: z.ZodOptional<z.ZodString>;
        preview: z.ZodString;
        serializedValue: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    summary: z.ZodOptional<z.ZodObject<{
        passed: z.ZodNumber;
        failed: z.ZodNumber;
        blocked: z.ZodNumber;
        skipped: z.ZodNumber;
        warning: z.ZodNumber;
    }, z.core.$strip>>;
    testCases: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nodeId: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<{
            "happy-path": "happy-path";
            "edge-case": "edge-case";
            "invalid-input": "invalid-input";
        }>;
        input: z.ZodString;
        expectation: z.ZodEnum<{
            warning: "warning";
            pass: "pass";
            fail: "fail";
        }>;
        notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    testResults: z.ZodDefault<z.ZodArray<z.ZodObject<{
        caseId: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<{
            "happy-path": "happy-path";
            "edge-case": "edge-case";
            "invalid-input": "invalid-input";
        }>;
        status: z.ZodEnum<{
            warning: "warning";
            pending: "pending";
            skipped: "skipped";
            blocked: "blocked";
            running: "running";
            passed: "passed";
            failed: "failed";
        }>;
        message: z.ZodString;
        stepIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type RuntimeExecutionResult = z.infer<typeof runtimeExecutionResultSchema>;
export declare const runtimeTestRequestSchema: z.ZodObject<{
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    nodeId: z.ZodString;
    seedInput: z.ZodOptional<z.ZodString>;
    codeDrafts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type RuntimeTestRequest = z.infer<typeof runtimeTestRequestSchema>;
export declare const runtimeTestResponseSchema: z.ZodObject<{
    nodeId: z.ZodString;
    testCases: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nodeId: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<{
            "happy-path": "happy-path";
            "edge-case": "edge-case";
            "invalid-input": "invalid-input";
        }>;
        input: z.ZodString;
        expectation: z.ZodEnum<{
            warning: "warning";
            pass: "pass";
            fail: "fail";
        }>;
        notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    results: z.ZodDefault<z.ZodArray<z.ZodObject<{
        caseId: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<{
            "happy-path": "happy-path";
            "edge-case": "edge-case";
            "invalid-input": "invalid-input";
        }>;
        status: z.ZodEnum<{
            warning: "warning";
            pending: "pending";
            skipped: "skipped";
            blocked: "blocked";
            running: "running";
            passed: "passed";
            failed: "failed";
        }>;
        message: z.ZodString;
        stepIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    runId: z.ZodOptional<z.ZodString>;
    steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        runId: z.ZodString;
        taskId: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            node: "node";
            method: "method";
            edge: "edge";
            test: "test";
        }>;
        nodeId: z.ZodString;
        parentNodeId: z.ZodOptional<z.ZodString>;
        methodName: z.ZodOptional<z.ZodString>;
        edgeId: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            warning: "warning";
            pending: "pending";
            skipped: "skipped";
            blocked: "blocked";
            running: "running";
            passed: "passed";
            failed: "failed";
        }>;
        startedAt: z.ZodString;
        completedAt: z.ZodString;
        durationMs: z.ZodNumber;
        stdout: z.ZodDefault<z.ZodString>;
        stderr: z.ZodDefault<z.ZodString>;
        message: z.ZodString;
        blockedByStepId: z.ZodOptional<z.ZodString>;
        inputPreview: z.ZodOptional<z.ZodString>;
        outputPreview: z.ZodOptional<z.ZodString>;
        artifactIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        contractChecks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            stage: z.ZodEnum<{
                output: "output";
                input: "input";
                test: "test";
                handoff: "handoff";
                "side-effect": "side-effect";
            }>;
            status: z.ZodEnum<{
                warning: "warning";
                skipped: "skipped";
                passed: "passed";
                failed: "failed";
            }>;
            expected: z.ZodOptional<z.ZodString>;
            actualPreview: z.ZodOptional<z.ZodString>;
            message: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceNodeId: z.ZodString;
        targetNodeId: z.ZodOptional<z.ZodString>;
        edgeId: z.ZodOptional<z.ZodString>;
        declaredType: z.ZodOptional<z.ZodString>;
        actualType: z.ZodOptional<z.ZodString>;
        preview: z.ZodString;
        serializedValue: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    summary: z.ZodOptional<z.ZodObject<{
        passed: z.ZodNumber;
        failed: z.ZodNumber;
        blocked: z.ZodNumber;
        skipped: z.ZodNumber;
        warning: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RuntimeTestResponse = z.infer<typeof runtimeTestResponseSchema>;
export declare const ghostNodeSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        function: "function";
        module: "module";
        api: "api";
        class: "class";
        "ui-screen": "ui-screen";
    }>;
    name: z.ZodString;
    summary: z.ZodString;
    reason: z.ZodString;
    provenance: z.ZodDefault<z.ZodEnum<{
        deterministic: "deterministic";
        ai: "ai";
        heuristic: "heuristic";
        simulated: "simulated";
        observed: "observed";
    }>>;
    maturity: z.ZodDefault<z.ZodEnum<{
        production: "production";
        preview: "preview";
        experimental: "experimental";
        scaffold: "scaffold";
    }>>;
    suggestedEdge: z.ZodOptional<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        kind: z.ZodEnum<{
            imports: "imports";
            calls: "calls";
            inherits: "inherits";
            renders: "renders";
            emits: "emits";
            consumes: "consumes";
            "reads-state": "reads-state";
            "writes-state": "writes-state";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GhostNode = z.input<typeof ghostNodeSchema>;
export type MaterializedGhostNode = z.infer<typeof ghostNodeSchema>;
export declare const ghostSuggestionsResponseSchema: z.ZodObject<{
    suggestions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            module: "module";
            api: "api";
            class: "class";
            "ui-screen": "ui-screen";
        }>;
        name: z.ZodString;
        summary: z.ZodString;
        reason: z.ZodString;
        provenance: z.ZodDefault<z.ZodEnum<{
            deterministic: "deterministic";
            ai: "ai";
            heuristic: "heuristic";
            simulated: "simulated";
            observed: "observed";
        }>>;
        maturity: z.ZodDefault<z.ZodEnum<{
            production: "production";
            preview: "preview";
            experimental: "experimental";
            scaffold: "scaffold";
        }>>;
        suggestedEdge: z.ZodOptional<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GhostSuggestionsResponse = z.infer<typeof ghostSuggestionsResponseSchema>;
export declare const emptyContract: () => CodeContract;
export declare const idleTraceState: () => TraceState;
export declare const graphBranchSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    projectName: z.ZodString;
    parentBranchId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GraphBranch = z.infer<typeof graphBranchSchema>;
export declare const nodeDiffKindSchema: z.ZodEnum<{
    modified: "modified";
    added: "added";
    removed: "removed";
    unchanged: "unchanged";
}>;
export type NodeDiffKind = z.infer<typeof nodeDiffKindSchema>;
export declare const edgeDiffKindSchema: z.ZodEnum<{
    added: "added";
    removed: "removed";
    unchanged: "unchanged";
}>;
export type EdgeDiffKind = z.infer<typeof edgeDiffKindSchema>;
export declare const nodeDiffSchema: z.ZodObject<{
    nodeId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<{
        modified: "modified";
        added: "added";
        removed: "removed";
        unchanged: "unchanged";
    }>;
    before: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            module: "module";
            api: "api";
            class: "class";
            "ui-screen": "ui-screen";
        }>;
        name: z.ZodString;
        summary: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
        signature: z.ZodOptional<z.ZodString>;
        contract: z.ZodObject<{
            summary: z.ZodString;
            responsibilities: z.ZodArray<z.ZodString>;
            inputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            outputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            attributes: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            methods: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                signature: z.ZodOptional<z.ZodString>;
                summary: z.ZodString;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            sideEffects: z.ZodArray<z.ZodString>;
            errors: z.ZodArray<z.ZodString>;
            dependencies: z.ZodArray<z.ZodString>;
            calls: z.ZodArray<z.ZodObject<{
                target: z.ZodString;
                kind: z.ZodOptional<z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    inherits: "inherits";
                    renders: "renders";
                    emits: "emits";
                    consumes: "consumes";
                    "reads-state": "reads-state";
                    "writes-state": "writes-state";
                }>>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            uiAccess: z.ZodArray<z.ZodString>;
            backendAccess: z.ZodArray<z.ZodString>;
            notes: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        sourceRefs: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                prd: "prd";
                repo: "repo";
                generated: "generated";
                trace: "trace";
            }>;
            path: z.ZodOptional<z.ZodString>;
            symbol: z.ZodOptional<z.ZodString>;
            section: z.ZodOptional<z.ZodString>;
            detail: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        generatedRefs: z.ZodArray<z.ZodString>;
        traceRefs: z.ZodArray<z.ZodString>;
        traceState: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                error: "error";
                idle: "idle";
                success: "success";
                warning: "warning";
            }>;
            count: z.ZodNumber;
            errors: z.ZodNumber;
            totalDurationMs: z.ZodNumber;
            lastSpanIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodDefault<z.ZodEnum<{
            spec_only: "spec_only";
            implemented: "implemented";
            verified: "verified";
            connected: "connected";
        }>>;
        specDraft: z.ZodOptional<z.ZodString>;
        implementationDraft: z.ZodOptional<z.ZodString>;
        lastVerification: z.ZodOptional<z.ZodObject<{
            verifiedAt: z.ZodString;
            status: z.ZodEnum<{
                success: "success";
                failure: "failure";
            }>;
            stdout: z.ZodString;
            stderr: z.ZodString;
            exitCode: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            serverUrl: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            headersRef: z.ZodOptional<z.ZodString>;
            enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    after: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            module: "module";
            api: "api";
            class: "class";
            "ui-screen": "ui-screen";
        }>;
        name: z.ZodString;
        summary: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
        signature: z.ZodOptional<z.ZodString>;
        contract: z.ZodObject<{
            summary: z.ZodString;
            responsibilities: z.ZodArray<z.ZodString>;
            inputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            outputs: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            attributes: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            methods: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                signature: z.ZodOptional<z.ZodString>;
                summary: z.ZodString;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            sideEffects: z.ZodArray<z.ZodString>;
            errors: z.ZodArray<z.ZodString>;
            dependencies: z.ZodArray<z.ZodString>;
            calls: z.ZodArray<z.ZodObject<{
                target: z.ZodString;
                kind: z.ZodOptional<z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    inherits: "inherits";
                    renders: "renders";
                    emits: "emits";
                    consumes: "consumes";
                    "reads-state": "reads-state";
                    "writes-state": "writes-state";
                }>>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            uiAccess: z.ZodArray<z.ZodString>;
            backendAccess: z.ZodArray<z.ZodString>;
            notes: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        sourceRefs: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                prd: "prd";
                repo: "repo";
                generated: "generated";
                trace: "trace";
            }>;
            path: z.ZodOptional<z.ZodString>;
            symbol: z.ZodOptional<z.ZodString>;
            section: z.ZodOptional<z.ZodString>;
            detail: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        generatedRefs: z.ZodArray<z.ZodString>;
        traceRefs: z.ZodArray<z.ZodString>;
        traceState: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                error: "error";
                idle: "idle";
                success: "success";
                warning: "warning";
            }>;
            count: z.ZodNumber;
            errors: z.ZodNumber;
            totalDurationMs: z.ZodNumber;
            lastSpanIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodDefault<z.ZodEnum<{
            spec_only: "spec_only";
            implemented: "implemented";
            verified: "verified";
            connected: "connected";
        }>>;
        specDraft: z.ZodOptional<z.ZodString>;
        implementationDraft: z.ZodOptional<z.ZodString>;
        lastVerification: z.ZodOptional<z.ZodObject<{
            verifiedAt: z.ZodString;
            status: z.ZodEnum<{
                success: "success";
                failure: "failure";
            }>;
            stdout: z.ZodString;
            stderr: z.ZodString;
            exitCode: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            serverUrl: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            headersRef: z.ZodOptional<z.ZodString>;
            enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    impactedEdgeCount: z.ZodNumber;
}, z.core.$strip>;
export type NodeDiff = z.infer<typeof nodeDiffSchema>;
export declare const edgeDiffSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    edgeKind: z.ZodEnum<{
        imports: "imports";
        calls: "calls";
        inherits: "inherits";
        renders: "renders";
        emits: "emits";
        consumes: "consumes";
        "reads-state": "reads-state";
        "writes-state": "writes-state";
    }>;
    diffKind: z.ZodEnum<{
        added: "added";
        removed: "removed";
        unchanged: "unchanged";
    }>;
}, z.core.$strip>;
export type EdgeDiff = z.infer<typeof edgeDiffSchema>;
export declare const branchDiffSchema: z.ZodObject<{
    baseId: z.ZodString;
    compareId: z.ZodString;
    addedNodes: z.ZodNumber;
    removedNodes: z.ZodNumber;
    modifiedNodes: z.ZodNumber;
    addedEdges: z.ZodNumber;
    removedEdges: z.ZodNumber;
    impactedNodeIds: z.ZodArray<z.ZodString>;
    nodeDiffs: z.ZodArray<z.ZodObject<{
        nodeId: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            modified: "modified";
            added: "added";
            removed: "removed";
            unchanged: "unchanged";
        }>;
        before: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        after: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        impactedEdgeCount: z.ZodNumber;
    }, z.core.$strip>>;
    edgeDiffs: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        edgeKind: z.ZodEnum<{
            imports: "imports";
            calls: "calls";
            inherits: "inherits";
            renders: "renders";
            emits: "emits";
            consumes: "consumes";
            "reads-state": "reads-state";
            "writes-state": "writes-state";
        }>;
        diffKind: z.ZodEnum<{
            added: "added";
            removed: "removed";
            unchanged: "unchanged";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BranchDiff = z.infer<typeof branchDiffSchema>;
/**
 * A single frame in a VCR recording, representing the cumulative state of the
 * architecture graph immediately after a particular trace span was processed.
 */
export declare const vcrFrameSchema: z.ZodObject<{
    frameIndex: z.ZodNumber;
    spanId: z.ZodString;
    label: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
    nodeId: z.ZodOptional<z.ZodString>;
    nodeName: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        error: "error";
        idle: "idle";
        success: "success";
        warning: "warning";
    }>;
    durationMs: z.ZodNumber;
    nodeStates: z.ZodRecord<z.ZodString, z.ZodObject<{
        status: z.ZodEnum<{
            error: "error";
            idle: "idle";
            success: "success";
            warning: "warning";
        }>;
        count: z.ZodNumber;
        errors: z.ZodNumber;
        totalDurationMs: z.ZodNumber;
        lastSpanIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type VcrFrame = z.infer<typeof vcrFrameSchema>;
/** A complete VCR recording derived from an observability snapshot. */
export declare const vcrRecordingSchema: z.ZodObject<{
    projectName: z.ZodString;
    recordedAt: z.ZodString;
    frames: z.ZodArray<z.ZodObject<{
        frameIndex: z.ZodNumber;
        spanId: z.ZodString;
        label: z.ZodString;
        timestamp: z.ZodOptional<z.ZodString>;
        nodeId: z.ZodOptional<z.ZodString>;
        nodeName: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            error: "error";
            idle: "idle";
            success: "success";
            warning: "warning";
        }>;
        durationMs: z.ZodNumber;
        nodeStates: z.ZodRecord<z.ZodString, z.ZodObject<{
            status: z.ZodEnum<{
                error: "error";
                idle: "idle";
                success: "success";
                warning: "warning";
            }>;
            count: z.ZodNumber;
            errors: z.ZodNumber;
            totalDurationMs: z.ZodNumber;
            lastSpanIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    totalSpans: z.ZodNumber;
}, z.core.$strip>;
export type VcrRecording = z.infer<typeof vcrRecordingSchema>;
/**
 * A single named user journey inferred from a group of trace spans that share
 * the same traceId.  The steps are the node IDs visited in chronological order.
 */
export declare const userFlowSchema: z.ZodObject<{
    traceId: z.ZodString;
    name: z.ZodString;
    nodeIds: z.ZodArray<z.ZodString>;
    startedAt: z.ZodOptional<z.ZodString>;
    endedAt: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        error: "error";
        success: "success";
        warning: "warning";
    }>;
    provenance: z.ZodEnum<{
        deterministic: "deterministic";
        ai: "ai";
        heuristic: "heuristic";
        simulated: "simulated";
        observed: "observed";
    }>;
    totalDurationMs: z.ZodNumber;
    spanCount: z.ZodNumber;
}, z.core.$strip>;
export type UserFlow = z.infer<typeof userFlowSchema>;
/**
 * A point-in-time snapshot of the Digital Twin state: which nodes are active
 * right now and what user flows have been observed.
 */
export declare const digitalTwinSnapshotSchema: z.ZodObject<{
    projectName: z.ZodString;
    computedAt: z.ZodString;
    maturity: z.ZodEnum<{
        production: "production";
        preview: "preview";
        experimental: "experimental";
        scaffold: "scaffold";
    }>;
    activeNodeIds: z.ZodArray<z.ZodString>;
    flows: z.ZodArray<z.ZodObject<{
        traceId: z.ZodString;
        name: z.ZodString;
        nodeIds: z.ZodArray<z.ZodString>;
        startedAt: z.ZodOptional<z.ZodString>;
        endedAt: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            error: "error";
            success: "success";
            warning: "warning";
        }>;
        provenance: z.ZodEnum<{
            deterministic: "deterministic";
            ai: "ai";
            heuristic: "heuristic";
            simulated: "simulated";
            observed: "observed";
        }>;
        totalDurationMs: z.ZodNumber;
        spanCount: z.ZodNumber;
    }, z.core.$strip>>;
    observedSpanCount: z.ZodNumber;
    simulatedSpanCount: z.ZodNumber;
    observedFlowCount: z.ZodNumber;
    simulatedFlowCount: z.ZodNumber;
    activeWindowSecs: z.ZodNumber;
}, z.core.$strip>;
export type DigitalTwinSnapshot = z.infer<typeof digitalTwinSnapshotSchema>;
/**
 * Request body for POST /api/digital-twin/simulate.
 * Describes a user action that should be simulated in the Digital Twin.
 */
export declare const simulateActionRequestSchema: z.ZodObject<{
    projectName: z.ZodString;
    nodeIds: z.ZodArray<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    runtime: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SimulateActionRequest = z.infer<typeof simulateActionRequestSchema>;
/** The architectural style applied to a generated variant. */
export declare const architectureStyleSchema: z.ZodEnum<{
    monolith: "monolith";
    microservices: "microservices";
    serverless: "serverless";
}>;
export type ArchitectureStyle = z.infer<typeof architectureStyleSchema>;
/** Benchmark scores (0–100, higher is better) for a single architecture variant. */
export declare const variantBenchmarkSchema: z.ZodObject<{
    scalability: z.ZodNumber;
    estimatedCostScore: z.ZodNumber;
    performance: z.ZodNumber;
    maintainability: z.ZodNumber;
    fitness: z.ZodNumber;
}, z.core.$strip>;
export type VariantBenchmark = z.infer<typeof variantBenchmarkSchema>;
/** A single architecture variant produced during the evolutionary tournament. */
export declare const architectureVariantSchema: z.ZodObject<{
    id: z.ZodString;
    style: z.ZodEnum<{
        monolith: "monolith";
        microservices: "microservices";
        serverless: "serverless";
    }>;
    generation: z.ZodNumber;
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    benchmark: z.ZodObject<{
        scalability: z.ZodNumber;
        estimatedCostScore: z.ZodNumber;
        performance: z.ZodNumber;
        maintainability: z.ZodNumber;
        fitness: z.ZodNumber;
    }, z.core.$strip>;
    provenance: z.ZodEnum<{
        deterministic: "deterministic";
        ai: "ai";
        heuristic: "heuristic";
        simulated: "simulated";
        observed: "observed";
    }>;
    maturity: z.ZodEnum<{
        production: "production";
        preview: "preview";
        experimental: "experimental";
        scaffold: "scaffold";
    }>;
    rank: z.ZodNumber;
}, z.core.$strip>;
export type ArchitectureVariant = z.infer<typeof architectureVariantSchema>;
/** Complete result of a genetic architecture tournament. */
export declare const tournamentResultSchema: z.ZodObject<{
    projectName: z.ZodString;
    evolvedAt: z.ZodString;
    provenance: z.ZodEnum<{
        deterministic: "deterministic";
        ai: "ai";
        heuristic: "heuristic";
        simulated: "simulated";
        observed: "observed";
    }>;
    maturity: z.ZodEnum<{
        production: "production";
        preview: "preview";
        experimental: "experimental";
        scaffold: "scaffold";
    }>;
    generationCount: z.ZodNumber;
    populationSize: z.ZodNumber;
    variants: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        style: z.ZodEnum<{
            monolith: "monolith";
            microservices: "microservices";
            serverless: "serverless";
        }>;
        generation: z.ZodNumber;
        graph: z.ZodObject<{
            projectName: z.ZodString;
            mode: z.ZodEnum<{
                essential: "essential";
                yolo: "yolo";
            }>;
            phase: z.ZodDefault<z.ZodEnum<{
                spec: "spec";
                implementation: "implementation";
                integration: "integration";
            }>>;
            generatedAt: z.ZodString;
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                kind: z.ZodEnum<{
                    function: "function";
                    module: "module";
                    api: "api";
                    class: "class";
                    "ui-screen": "ui-screen";
                }>;
                name: z.ZodString;
                summary: z.ZodString;
                path: z.ZodOptional<z.ZodString>;
                ownerId: z.ZodOptional<z.ZodString>;
                signature: z.ZodOptional<z.ZodString>;
                contract: z.ZodObject<{
                    summary: z.ZodString;
                    responsibilities: z.ZodArray<z.ZodString>;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    attributes: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    methods: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        signature: z.ZodOptional<z.ZodString>;
                        summary: z.ZodString;
                        inputs: z.ZodArray<z.ZodObject<{
                            name: z.ZodString;
                            type: z.ZodString;
                            description: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>;
                        outputs: z.ZodArray<z.ZodObject<{
                            name: z.ZodString;
                            type: z.ZodString;
                            description: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>;
                        sideEffects: z.ZodArray<z.ZodString>;
                        calls: z.ZodArray<z.ZodObject<{
                            target: z.ZodString;
                            kind: z.ZodOptional<z.ZodEnum<{
                                imports: "imports";
                                calls: "calls";
                                inherits: "inherits";
                                renders: "renders";
                                emits: "emits";
                                consumes: "consumes";
                                "reads-state": "reads-state";
                                "writes-state": "writes-state";
                            }>>;
                            description: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    errors: z.ZodArray<z.ZodString>;
                    dependencies: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    uiAccess: z.ZodArray<z.ZodString>;
                    backendAccess: z.ZodArray<z.ZodString>;
                    notes: z.ZodArray<z.ZodString>;
                }, z.core.$strip>;
                sourceRefs: z.ZodArray<z.ZodObject<{
                    kind: z.ZodEnum<{
                        prd: "prd";
                        repo: "repo";
                        generated: "generated";
                        trace: "trace";
                    }>;
                    path: z.ZodOptional<z.ZodString>;
                    symbol: z.ZodOptional<z.ZodString>;
                    section: z.ZodOptional<z.ZodString>;
                    detail: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                generatedRefs: z.ZodArray<z.ZodString>;
                traceRefs: z.ZodArray<z.ZodString>;
                traceState: z.ZodOptional<z.ZodObject<{
                    status: z.ZodEnum<{
                        error: "error";
                        idle: "idle";
                        success: "success";
                        warning: "warning";
                    }>;
                    count: z.ZodNumber;
                    errors: z.ZodNumber;
                    totalDurationMs: z.ZodNumber;
                    lastSpanIds: z.ZodArray<z.ZodString>;
                }, z.core.$strip>>;
                status: z.ZodDefault<z.ZodEnum<{
                    spec_only: "spec_only";
                    implemented: "implemented";
                    verified: "verified";
                    connected: "connected";
                }>>;
                specDraft: z.ZodOptional<z.ZodString>;
                implementationDraft: z.ZodOptional<z.ZodString>;
                lastVerification: z.ZodOptional<z.ZodObject<{
                    verifiedAt: z.ZodString;
                    status: z.ZodEnum<{
                        success: "success";
                        failure: "failure";
                    }>;
                    stdout: z.ZodString;
                    stderr: z.ZodString;
                    exitCode: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    serverUrl: z.ZodString;
                    label: z.ZodOptional<z.ZodString>;
                    headersRef: z.ZodOptional<z.ZodString>;
                    enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>>>;
            }, z.core.$strip>>;
            edges: z.ZodArray<z.ZodObject<{
                from: z.ZodString;
                to: z.ZodString;
                kind: z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    inherits: "inherits";
                    renders: "renders";
                    emits: "emits";
                    consumes: "consumes";
                    "reads-state": "reads-state";
                    "writes-state": "writes-state";
                }>;
                label: z.ZodOptional<z.ZodString>;
                required: z.ZodBoolean;
                confidence: z.ZodNumber;
            }, z.core.$strip>>;
            workflows: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                steps: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            warnings: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        benchmark: z.ZodObject<{
            scalability: z.ZodNumber;
            estimatedCostScore: z.ZodNumber;
            performance: z.ZodNumber;
            maintainability: z.ZodNumber;
            fitness: z.ZodNumber;
        }, z.core.$strip>;
        provenance: z.ZodEnum<{
            deterministic: "deterministic";
            ai: "ai";
            heuristic: "heuristic";
            simulated: "simulated";
            observed: "observed";
        }>;
        maturity: z.ZodEnum<{
            production: "production";
            preview: "preview";
            experimental: "experimental";
            scaffold: "scaffold";
        }>;
        rank: z.ZodNumber;
    }, z.core.$strip>>;
    winnerId: z.ZodString;
    summary: z.ZodString;
}, z.core.$strip>;
export type TournamentResult = z.infer<typeof tournamentResultSchema>;
/** Request body for POST /api/genetic/evolve. */
export declare const evolveArchitectureRequestSchema: z.ZodObject<{
    graph: z.ZodObject<{
        projectName: z.ZodString;
        mode: z.ZodEnum<{
            essential: "essential";
            yolo: "yolo";
        }>;
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                function: "function";
                module: "module";
                api: "api";
                class: "class";
                "ui-screen": "ui-screen";
            }>;
            name: z.ZodString;
            summary: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            ownerId: z.ZodOptional<z.ZodString>;
            signature: z.ZodOptional<z.ZodString>;
            contract: z.ZodObject<{
                summary: z.ZodString;
                responsibilities: z.ZodArray<z.ZodString>;
                inputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                outputs: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attributes: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    outputs: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    sideEffects: z.ZodArray<z.ZodString>;
                    calls: z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                        kind: z.ZodOptional<z.ZodEnum<{
                            imports: "imports";
                            calls: "calls";
                            inherits: "inherits";
                            renders: "renders";
                            emits: "emits";
                            consumes: "consumes";
                            "reads-state": "reads-state";
                            "writes-state": "writes-state";
                        }>>;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                sideEffects: z.ZodArray<z.ZodString>;
                errors: z.ZodArray<z.ZodString>;
                dependencies: z.ZodArray<z.ZodString>;
                calls: z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                    kind: z.ZodOptional<z.ZodEnum<{
                        imports: "imports";
                        calls: "calls";
                        inherits: "inherits";
                        renders: "renders";
                        emits: "emits";
                        consumes: "consumes";
                        "reads-state": "reads-state";
                        "writes-state": "writes-state";
                    }>>;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                uiAccess: z.ZodArray<z.ZodString>;
                backendAccess: z.ZodArray<z.ZodString>;
                notes: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            sourceRefs: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    prd: "prd";
                    repo: "repo";
                    generated: "generated";
                    trace: "trace";
                }>;
                path: z.ZodOptional<z.ZodString>;
                symbol: z.ZodOptional<z.ZodString>;
                section: z.ZodOptional<z.ZodString>;
                detail: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            generatedRefs: z.ZodArray<z.ZodString>;
            traceRefs: z.ZodArray<z.ZodString>;
            traceState: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    error: "error";
                    idle: "idle";
                    success: "success";
                    warning: "warning";
                }>;
                count: z.ZodNumber;
                errors: z.ZodNumber;
                totalDurationMs: z.ZodNumber;
                lastSpanIds: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
            lastVerification: z.ZodOptional<z.ZodObject<{
                verifiedAt: z.ZodString;
                status: z.ZodEnum<{
                    success: "success";
                    failure: "failure";
                }>;
                stdout: z.ZodString;
                stderr: z.ZodString;
                exitCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            mcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                serverUrl: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                headersRef: z.ZodOptional<z.ZodString>;
                enabledTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodEnum<{
                imports: "imports";
                calls: "calls";
                inherits: "inherits";
                renders: "renders";
                emits: "emits";
                consumes: "consumes";
                "reads-state": "reads-state";
                "writes-state": "writes-state";
            }>;
            label: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        workflows: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    generations: z.ZodDefault<z.ZodNumber>;
    populationSize: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type EvolveArchitectureRequest = z.infer<typeof evolveArchitectureRequestSchema>;
