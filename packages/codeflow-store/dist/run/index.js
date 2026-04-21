import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const createRunId = () => crypto.randomUUID();
export const saveRunRecord = async (runRecord) => {
    const filePath = runPath(runRecord.id);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(runRecord, null, 2)}\n`, "utf8");
};
//# sourceMappingURL=index.js.map