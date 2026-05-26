import { z } from "zod";
export declare const architectureStyleSchema: z.ZodEnum<{
    monolith: "monolith";
    microservices: "microservices";
    serverless: "serverless";
}>;
export type ArchitectureStyle = z.infer<typeof architectureStyleSchema>;
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
export declare const nodeStatusSchema: z.ZodEnum<{
    spec_only: "spec_only";
    implemented: "implemented";
    verified: "verified";
    connected: "connected";
}>;
export type NodeStatus = z.infer<typeof nodeStatusSchema>;
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
export declare const methodSpecSchema: z.ZodObject<{
    name: z.ZodString;
    signature: z.ZodOptional<z.ZodString>;
    summary: z.ZodString;
    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
    calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
        target: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type MethodSpec = z.infer<typeof methodSpecSchema>;
export declare const codeContractSchema: z.ZodObject<{
    summary: z.ZodString;
    responsibilities: z.ZodArray<z.ZodString>;
    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    attributes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    methods: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        signature: z.ZodOptional<z.ZodString>;
        summary: z.ZodString;
        inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
        calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
            target: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
    errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
    calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
        target: z.ZodString;
    }, z.core.$strip>>>;
    uiAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
    backendAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
    notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
        inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        attributes: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        methods: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            signature: z.ZodOptional<z.ZodString>;
            summary: z.ZodString;
            inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
            calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                target: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
        errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
        dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
        calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
            target: z.ZodString;
        }, z.core.$strip>>>;
        uiAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
        backendAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
        notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    sourceRefs: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>>;
    generatedRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    traceRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        spec_only: "spec_only";
        implemented: "implemented";
        verified: "verified";
        connected: "connected";
    }>>;
    specDraft: z.ZodOptional<z.ZodString>;
    implementationDraft: z.ZodOptional<z.ZodString>;
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
export declare const blueprintPhaseSchema: z.ZodEnum<{
    spec: "spec";
    implementation: "implementation";
    integration: "integration";
}>;
export type BlueprintPhase = z.infer<typeof blueprintPhaseSchema>;
export declare const blueprintGraphSchema: z.ZodObject<{
    projectName: z.ZodString;
    phase: z.ZodDefault<z.ZodEnum<{
        spec: "spec";
        implementation: "implementation";
        integration: "integration";
    }>>;
    generatedAt: z.ZodOptional<z.ZodString>;
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
            inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            attributes: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            methods: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                signature: z.ZodOptional<z.ZodString>;
                summary: z.ZodString;
                inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
                outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
                sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
                calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                }, z.core.$strip>>>;
            }, z.core.$strip>>>;
            sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
            errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
            dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
            calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                target: z.ZodString;
            }, z.core.$strip>>>;
            uiAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
            backendAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
            notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        sourceRefs: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        generatedRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        traceRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            spec_only: "spec_only";
            implemented: "implemented";
            verified: "verified";
            connected: "connected";
        }>>;
        specDraft: z.ZodOptional<z.ZodString>;
        implementationDraft: z.ZodOptional<z.ZodString>;
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
    workflows: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        steps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type BlueprintGraph = z.input<typeof blueprintGraphSchema>;
export type MaterializedBlueprintGraph = z.infer<typeof blueprintGraphSchema>;
export declare const variantBenchmarkSchema: z.ZodObject<{
    scalability: z.ZodNumber;
    estimatedCostScore: z.ZodNumber;
    performance: z.ZodNumber;
    maintainability: z.ZodNumber;
    fitness: z.ZodNumber;
}, z.core.$strip>;
export type VariantBenchmark = z.infer<typeof variantBenchmarkSchema>;
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
        phase: z.ZodDefault<z.ZodEnum<{
            spec: "spec";
            implementation: "implementation";
            integration: "integration";
        }>>;
        generatedAt: z.ZodOptional<z.ZodString>;
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
                inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
                outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
                attributes: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
                methods: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    signature: z.ZodOptional<z.ZodString>;
                    summary: z.ZodString;
                    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>>;
                    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>>;
                    sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
                    calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                    }, z.core.$strip>>>;
                }, z.core.$strip>>>;
                sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
                errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
                dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
                calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    target: z.ZodString;
                }, z.core.$strip>>>;
                uiAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
                backendAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
                notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>;
            sourceRefs: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }, z.core.$strip>>>;
            generatedRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            traceRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                spec_only: "spec_only";
                implemented: "implemented";
                verified: "verified";
                connected: "connected";
            }>>;
            specDraft: z.ZodOptional<z.ZodString>;
            implementationDraft: z.ZodOptional<z.ZodString>;
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
        workflows: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            steps: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>>;
        warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
            phase: z.ZodDefault<z.ZodEnum<{
                spec: "spec";
                implementation: "implementation";
                integration: "integration";
            }>>;
            generatedAt: z.ZodOptional<z.ZodString>;
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
                    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>>;
                    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>>;
                    attributes: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        type: z.ZodString;
                        description: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>>;
                    methods: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        signature: z.ZodOptional<z.ZodString>;
                        summary: z.ZodString;
                        inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                            name: z.ZodString;
                            type: z.ZodString;
                            description: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>>;
                        outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                            name: z.ZodString;
                            type: z.ZodString;
                            description: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>>;
                        sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
                        calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                            target: z.ZodString;
                        }, z.core.$strip>>>;
                    }, z.core.$strip>>>;
                    sideEffects: z.ZodDefault<z.ZodArray<z.ZodString>>;
                    errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
                    dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
                    calls: z.ZodDefault<z.ZodArray<z.ZodObject<{
                        target: z.ZodString;
                    }, z.core.$strip>>>;
                    uiAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
                    backendAccess: z.ZodDefault<z.ZodArray<z.ZodString>>;
                    notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>;
                sourceRefs: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
                }, z.core.$strip>>>;
                generatedRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
                traceRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
                status: z.ZodDefault<z.ZodEnum<{
                    spec_only: "spec_only";
                    implemented: "implemented";
                    verified: "verified";
                    connected: "connected";
                }>>;
                specDraft: z.ZodOptional<z.ZodString>;
                implementationDraft: z.ZodOptional<z.ZodString>;
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
            workflows: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                steps: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>>;
            warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
export declare const graphMetricsSchema: z.ZodObject<{
    analyzedAt: z.ZodString;
    nodeCount: z.ZodNumber;
    edgeCount: z.ZodNumber;
    nodesByKind: z.ZodRecord<z.ZodString, z.ZodNumber>;
    edgesByKind: z.ZodRecord<z.ZodString, z.ZodNumber>;
    nodesByStatus: z.ZodRecord<z.ZodString, z.ZodNumber>;
    density: z.ZodNumber;
    avgDegree: z.ZodNumber;
    maxInDegree: z.ZodNumber;
    maxOutDegree: z.ZodNumber;
    maxInDegreeNodeId: z.ZodOptional<z.ZodString>;
    maxOutDegreeNodeId: z.ZodOptional<z.ZodString>;
    avgMethodsPerNode: z.ZodNumber;
    avgResponsibilitiesPerNode: z.ZodNumber;
    totalMethods: z.ZodNumber;
    totalResponsibilities: z.ZodNumber;
    connectedComponents: z.ZodNumber;
    isolatedNodes: z.ZodNumber;
    leafNodes: z.ZodNumber;
}, z.core.$strip>;
export type GraphMetrics = z.infer<typeof graphMetricsSchema>;
export declare const emptyContract: () => CodeContract;
//# sourceMappingURL=schema.d.ts.map