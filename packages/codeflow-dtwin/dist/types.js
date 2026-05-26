// Empty contract factory (needed for test fixtures)
export const emptyContract = () => ({
    summary: "",
    responsibilities: [],
    inputs: [],
    outputs: [],
    attributes: [],
    methods: [],
    sideEffects: [],
    errors: [],
    dependencies: [],
    calls: [],
    uiAccess: [],
    backendAccess: [],
    notes: []
});
// Idle trace state factory
export const idleTraceState = () => ({
    status: "idle",
    count: 0,
    errors: 0,
    totalDurationMs: 0,
    lastSpanIds: []
});
//# sourceMappingURL=types.js.map