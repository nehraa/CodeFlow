import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";


export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 30000,
    // Allow tests to run from the package directory
    cwd: path.resolve(fileURLToPath(import.meta.url), ".."),
  },
});
