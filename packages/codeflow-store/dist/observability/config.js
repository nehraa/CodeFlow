import fs from "node:fs/promises";
import path from "node:path";
import { getStoreRoot } from "../shared/utils.js";
const DEFAULT_CONFIG = { maxSpans: 500, maxLogs: 2000 };
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";
const configPath = (projectName) => path.join(getStoreRoot(), "observability-config", `${slugify(projectName)}.json`);
export const loadObservabilityConfig = async (projectName) => {
    try {
        const content = await fs.readFile(configPath(projectName), "utf8");
        const parsed = JSON.parse(content);
        const maxSpans = typeof parsed.maxSpans === "number" ? parsed.maxSpans : DEFAULT_CONFIG.maxSpans;
        const maxLogs = typeof parsed.maxLogs === "number" ? parsed.maxLogs : DEFAULT_CONFIG.maxLogs;
        // Enforce caps on loaded values to prevent memory exhaustion from malicious files
        return {
            maxSpans: Math.min(Math.max(1, maxSpans), 50000),
            maxLogs: Math.min(Math.max(1, maxLogs), 50000)
        };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
};
export const saveObservabilityConfig = async (projectName, config) => {
    if (config.maxSpans < 1 || config.maxSpans > 50000) {
        throw new Error(`maxSpans must be between 1 and 50000; received: ${config.maxSpans}`);
    }
    if (config.maxLogs < 1 || config.maxLogs > 50000) {
        throw new Error(`maxLogs must be between 1 and 50000; received: ${config.maxLogs}`);
    }
    await fs.mkdir(path.dirname(configPath(projectName)), { recursive: true });
    await fs.writeFile(configPath(projectName), JSON.stringify(config, null, 2), "utf8");
};
//# sourceMappingURL=config.js.map