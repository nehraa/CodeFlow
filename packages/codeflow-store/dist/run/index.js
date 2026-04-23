import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runRecordSchema } from "@abhinav2203/codeflow-core/schema";
import { runPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const createRunId = (projectId) => {
    if (projectId !== undefined) {
        throw new Error(`createRunId takes no arguments; received: ${JSON.stringify(projectId)}`);
    }
    return crypto.randomUUID();
};
export const saveRunRecord = async (runRecord) => {
    if (runRecord == null) {
        throw new Error("saveRunRecord: runRecord is required; received null");
    }
    if (typeof runRecord !== "object") {
        throw new Error(`saveRunRecord: runRecord must be an object; received: ${JSON.stringify(runRecord)} (type: ${typeof runRecord})`);
    }
    if (Array.isArray(runRecord)) {
        throw new Error(`saveRunRecord: runRecord must be an object, not an array`);
    }
    // Normalize common caller mistake: runId → id
    const normalized = {
        ...runRecord,
        id: runRecord.id ?? runRecord.runId
    };
    const validated = runRecordSchema.parse(normalized);
    const filePath = runPath(validated.id);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    return validated;
};
//# sourceMappingURL=index.js.map