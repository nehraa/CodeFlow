import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeRepo } from "./repo-multi.js";
import { resetLoader } from "./tree-sitter-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../../test-fixtures");

describe("analyzeRepo", () => {
  afterAll(() => {
    resetLoader();
  });

  describe("Go", () => {
    it("extracts functions, classes, and calls from Go repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-go"));

      const nodeNames = result.nodes.map(n => n.name);
      const nodeKinds = new Map(result.nodes.map(n => [n.id, n.kind]));

      // Module node
      expect(result.nodes.some(n => n.kind === "module" && n.name === "main.go")).toBe(true);

      // Function nodes
      expect(result.nodes.some(n => n.kind === "function" && n.name === "ProcessData")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "formatString")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "main")).toBe(true);

      // Class (struct) node
      expect(result.nodes.some(n => n.kind === "class" && n.name === "UserService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "Database")).toBe(true);

      // Methods
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.GetUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.SaveUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "Database.Connect")).toBe(true);

      // All nodes have required fields
      for (const node of result.nodes) {
        expect(node.id).toBeDefined();
        expect(node.kind).toBeDefined();
        expect(node.name).toBeDefined();
        expect(node.summary).toBeDefined();
        expect(node.path).toBeDefined();
        expect(node.sourceRefs).toBeDefined();
        expect(node.sourceRefs.length).toBeGreaterThan(0);
        expect(node.sourceRefs[0].kind).toBe("repo");
      }

      // Calls edges
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("Python", () => {
    it("extracts functions, classes, methods, and calls from Python repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-python"));

      // Module node
      expect(result.nodes.some(n => n.kind === "module" && n.name === "service.py")).toBe(true);

      // Functions
      expect(result.nodes.some(n => n.kind === "function" && n.name === "load_config")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "process_data")).toBe(true);

      // Classes
      expect(result.nodes.some(n => n.kind === "class" && n.name === "UserService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "BaseService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "TaskService")).toBe(true);

      // Methods
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.get_user")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.save_user")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "TaskService.create_task")).toBe(true);

      // Calls edges exist
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("C", () => {
    it("extracts functions and calls from C repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-c"));

      // Module node
      expect(result.nodes.some(n => n.kind === "module" && n.name === "main.c")).toBe(true);

      // Functions
      expect(result.nodes.some(n => n.kind === "function" && n.name === "process_data")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "calculate_sum")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "print_result")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "main")).toBe(true);

      // Calls edges
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("C++", () => {
    it("extracts classes, inheritance, methods, and calls from C++ repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-cpp"));

      // Module
      expect(result.nodes.some(n => n.kind === "module" && n.name === "main.cpp")).toBe(true);

      // Classes
      expect(result.nodes.some(n => n.kind === "class" && n.name === "BaseService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "UserService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "TaskService")).toBe(true);

      // Function
      expect(result.nodes.some(n => n.kind === "function" && n.name === "process_data")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "main")).toBe(true);

      // Methods
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.getUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.saveUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "TaskService.createTask")).toBe(true);

      // Inheritance edges
      const inheritEdges = result.edges.filter(e => e.kind === "inherits");
      expect(inheritEdges.length).toBeGreaterThan(0);

      // Calls edges
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("Rust", () => {
    it("extracts structs, impl methods, and calls from Rust repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-rust"));

      // Module
      expect(result.nodes.some(n => n.kind === "module" && n.name === "main.rs")).toBe(true);

      // Functions
      expect(result.nodes.some(n => n.kind === "function" && n.name === "process_data")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "calculate_total")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "main")).toBe(true);

      // Structs/classes
      expect(result.nodes.some(n => n.kind === "class" && n.name === "UserService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "TaskService")).toBe(true);

      // Methods
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.get_user")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.save_user")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "TaskService.create_task")).toBe(true);

      // Calls edges
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("TypeScript", () => {
    it("extracts classes, inheritance, methods, imports, and calls from TS repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-ts"));

      // Module nodes
      expect(result.nodes.some(n => n.kind === "module" && n.name === "service.ts")).toBe(true);
      expect(result.nodes.some(n => n.kind === "module" && n.name === "base-service.ts")).toBe(true);

      // Functions
      expect(result.nodes.some(n => n.kind === "function" && n.name === "processData")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "calculateSum")).toBe(true);

      // Classes
      expect(result.nodes.some(n => n.kind === "class" && n.name === "UserService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "BaseService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "TaskService")).toBe(true);

      // Methods
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.getUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.saveUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "TaskService.createTask")).toBe(true);

      // Inheritance edges
      const inheritEdges = result.edges.filter(e => e.kind === "inherits");
      expect(inheritEdges.length).toBeGreaterThan(0);

      // Calls edges
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("JavaScript", () => {
    it("extracts classes, inheritance, methods, and calls from JS repo", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-js"));

      // Module nodes
      expect(result.nodes.some(n => n.kind === "module" && n.name === "service.js")).toBe(true);

      // Functions
      expect(result.nodes.some(n => n.kind === "function" && n.name === "processData")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "calculateSum")).toBe(true);

      // Classes
      expect(result.nodes.some(n => n.kind === "class" && n.name === "UserService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "BaseService")).toBe(true);
      expect(result.nodes.some(n => n.kind === "class" && n.name === "TaskService")).toBe(true);

      // Methods
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.getUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "UserService.saveUser")).toBe(true);
      expect(result.nodes.some(n => n.kind === "function" && n.name === "TaskService.createTask")).toBe(true);

      // Inheritance edges
      const inheritEdges = result.edges.filter(e => e.kind === "inherits");
      expect(inheritEdges.length).toBeGreaterThan(0);

      // Calls edges
      const callEdges = result.edges.filter(e => e.kind === "calls");
      expect(callEdges.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("throws for invalid path", async () => {
      await expect(analyzeRepo("/nonexistent/path")).rejects.toThrow();
    });

    it("returns warnings for empty directory", async () => {
      const emptyDir = path.join(FIXTURES_DIR, "empty-test-dir");
      const fs = await import("node:fs/promises");
      await fs.mkdir(emptyDir, { recursive: true });

      const result = await analyzeRepo(emptyDir);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.nodes.length).toBe(0);

      await fs.rmdir(emptyDir);
    });

    it("generates summaries from comments", async () => {
      const result = await analyzeRepo(path.join(FIXTURES_DIR, "sample-go"));
      const processDataNode = result.nodes.find(n => n.name === "ProcessData");
      expect(processDataNode).toBeDefined();
      expect(processDataNode!.summary.length).toBeGreaterThan(0);
      // Should contain the comment text
      expect(processDataNode!.summary.toLowerCase()).toContain("process");
    });

    it("excludes node_modules and other excluded dirs", async () => {
      const testDir = path.join(FIXTURES_DIR, "sample-ts");
      const fs = await import("node:fs/promises");
      const nmDir = path.join(testDir, "node_modules");
      await fs.mkdir(nmDir, { recursive: true });
      await fs.writeFile(path.join(nmDir, "bad.ts"), "function badFunc() {}");

      const result = await analyzeRepo(testDir);
      expect(result.nodes.some(n => n.name.includes("node_modules"))).toBe(false);

      await fs.rm(nmDir, { recursive: true, force: true });
    });
  });
});
