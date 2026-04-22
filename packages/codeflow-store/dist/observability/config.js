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
        return {
            maxSpans: parsed.maxSpans ?? DEFAULT_CONFIG.maxSpans,
            maxLogs: parsed.maxLogs ?? DEFAULT_CONFIG.maxLogs
        };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
};
export const saveObservabilityConfig = async (projectName, config) => {
    await fs.mkdir(path.dirname(configPath(projectName)), { recursive: true });
    await fs.writeFile(configPath(projectName), JSON.stringify(config, null, 2), "utf8");
};
//# sourceMappingURL=config.js.map