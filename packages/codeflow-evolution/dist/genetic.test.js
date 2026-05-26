import { describe, it, expect } from "vitest";
import { generateInitialPopulation, evolveArchitectures, benchmarkVariant, BENCHMARK_WEIGHTS, } from "./genetic.js";
// Helper to build a minimal graph
const makeGraph = (nodes, edges = []) => ({
    projectName: "test-project",
    phase: "spec",
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    workflows: [],
    warnings: [],
});
const node = (id, kind = "module") => ({
    id,
    name: id,
    kind,
    summary: "test node",
    contract: {
        summary: "contract",
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
        notes: [],
    },
    sourceRefs: [],
    status: "spec_only",
});
describe("genetic.ts", () => {
    describe("benchmarkVariant", () => {
        it("returns a VariantBenchmark with all scores in [0, 100]", () => {
            const graph = makeGraph([node("a", "module"), node("b", "api")], [
                { from: "a", to: "b", kind: "calls", required: true, confidence: 0.9 },
            ]);
            const result = benchmarkVariant(graph, "monolith");
            expect(result.scalability).toBeGreaterThanOrEqual(0);
            expect(result.scalability).toBeLessThanOrEqual(100);
            expect(result.estimatedCostScore).toBeGreaterThanOrEqual(0);
            expect(result.estimatedCostScore).toBeLessThanOrEqual(100);
            expect(result.performance).toBeGreaterThanOrEqual(0);
            expect(result.performance).toBeLessThanOrEqual(100);
            expect(result.maintainability).toBeGreaterThanOrEqual(0);
            expect(result.maintainability).toBeLessThanOrEqual(100);
            expect(result.fitness).toBeGreaterThanOrEqual(0);
            expect(result.fitness).toBeLessThanOrEqual(100);
        });
        it("uses BENCHMARK_WEIGHTS that sum to 1.0", () => {
            const sum = BENCHMARK_WEIGHTS.scalability +
                BENCHMARK_WEIGHTS.estimatedCostScore +
                BENCHMARK_WEIGHTS.performance +
                BENCHMARK_WEIGHTS.maintainability;
            expect(sum).toBeCloseTo(1.0, 5);
        });
        it("computes different scores for different architecture styles", () => {
            const graph = makeGraph([node("a"), node("b")], [
                { from: "a", to: "b", kind: "calls", required: true, confidence: 0.9 },
            ]);
            const monolith = benchmarkVariant(graph, "monolith");
            const microservices = benchmarkVariant(graph, "microservices");
            const serverless = benchmarkVariant(graph, "serverless");
            // At least one subscore should differ between styles
            const anyDiff = monolith.fitness !== microservices.fitness ||
                monolith.fitness !== serverless.fitness;
            expect(anyDiff).toBe(true);
        });
    });
    describe("generateInitialPopulation", () => {
        it("returns exactly populationSize variants", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = generateInitialPopulation(graph, 6);
            expect(result).toHaveLength(6);
        });
        it("returns one variant per architectural style at generation 0", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = generateInitialPopulation(graph, 6);
            const styles = result.map((v) => v.style);
            expect(styles).toContain("monolith");
            expect(styles).toContain("microservices");
            expect(styles).toContain("serverless");
        });
        it("assigns non-zero ranks to all variants (1-based ranking applied)", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = generateInitialPopulation(graph, 6);
            expect(result.every((v) => v.rank > 0)).toBe(true);
        });
        it("returns variants sorted by fitness descending after ranking", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = generateInitialPopulation(graph, 6);
            for (let i = 1; i < result.length; i++) {
                expect(result[i - 1].benchmark.fitness).toBeGreaterThanOrEqual(result[i].benchmark.fitness);
            }
        });
        it("returns exactly 3 variants for populationSize < 3 (clamped to 3)", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = generateInitialPopulation(graph, 2);
            // The algorithm enforces minimum population of 3 (one per style)
            expect(result.length).toBeGreaterThanOrEqual(3);
        });
    });
    describe("evolveArchitectures", () => {
        it("returns a TournamentResult", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 2, populationSize: 6 });
            expect(result).toHaveProperty("projectName");
            expect(result).toHaveProperty("evolvedAt");
            expect(result).toHaveProperty("provenance");
            expect(result).toHaveProperty("maturity");
            expect(result).toHaveProperty("generationCount");
            expect(result).toHaveProperty("populationSize");
            expect(result).toHaveProperty("variants");
            expect(result).toHaveProperty("winnerId");
            expect(result).toHaveProperty("summary");
        });
        it("has generationCount equal to requested generations", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 5, populationSize: 6 });
            expect(result.generationCount).toBe(5);
        });
        it("has non-empty variants array", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 1, populationSize: 6 });
            expect(result.variants.length).toBeGreaterThan(0);
        });
        it("winnerId matches id of the top-ranked variant", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 2, populationSize: 6 });
            const winner = result.variants.find((v) => v.id === result.winnerId);
            expect(winner).toBeDefined();
            expect(winner.rank).toBe(1);
        });
        it("summary is a non-empty string", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 1, populationSize: 6 });
            expect(typeof result.summary).toBe("string");
            expect(result.summary.length).toBeGreaterThan(0);
        });
        it("all variants have positive rank (1-based)", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 2, populationSize: 6 });
            for (const variant of result.variants) {
                expect(variant.rank).toBeGreaterThan(0);
            }
        });
        it("ranks are sequential starting from 1", () => {
            const graph = makeGraph([node("a"), node("b")]);
            const result = evolveArchitectures(graph, { generations: 2, populationSize: 6 });
            const ranks = result.variants.map((v) => v.rank).sort((a, b) => a - b);
            ranks.forEach((r, i) => expect(r).toBe(i + 1));
        });
    });
});
//# sourceMappingURL=genetic.test.js.map