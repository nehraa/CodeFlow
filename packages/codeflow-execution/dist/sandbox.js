import fs from "node:fs/promises";
import path from "node:path";
const listFiles = async (rootDir) => {
    const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
    const files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            return listFiles(fullPath);
        }
        return [fullPath];
    }));
    return files.flat();
};
const fileHash = async (filePath) => fs
    .readFile(filePath, "utf8")
    .catch(() => "")
    .then((content) => content);
export const createSandboxDir = async (runId) => {
    const sandboxDir = path.resolve(process.cwd(), ".codeflow-sandboxes", runId);
    await fs.mkdir(sandboxDir, { recursive: true });
    return sandboxDir;
};
export const writeDiffManifest = async ({ sandboxResult, targetDir }) => {
    const sandboxFiles = await listFiles(sandboxResult.rootDir);
    const diffEntries = [];
    for (const filePath of sandboxFiles) {
        const relativePath = path.relative(sandboxResult.rootDir, filePath);
        const targetPath = path.join(targetDir, relativePath);
        const targetExists = await fs
            .stat(targetPath)
            .then((stats) => stats.isFile())
            .catch(() => false);
        const sandboxContent = await fileHash(filePath);
        const targetContent = targetExists ? await fileHash(targetPath) : "";
        diffEntries.push({
            path: relativePath,
            status: !targetExists ? "added" : sandboxContent === targetContent ? "unchanged" : "changed"
        });
    }
    const diffPath = path.join(sandboxResult.rootDir, "diff.json");
    await fs.writeFile(diffPath, `${JSON.stringify(diffEntries, null, 2)}\n`, "utf8");
    return diffPath;
};
export const syncSandboxToTarget = async ({ sandboxDir, targetDir }) => {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(sandboxDir, targetDir, { recursive: true, force: true });
};
