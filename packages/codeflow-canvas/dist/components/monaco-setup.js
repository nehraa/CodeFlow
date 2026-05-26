import { getTypeScriptLanguageService } from "./ts-language-service.js";
let workersConfigured = false;
export function prepareMonaco(monaco) {
    if (!workersConfigured) {
        const monacoGlobal = globalThis;
        monacoGlobal.MonacoEnvironment = {
            getWorker(_workerId, label) {
                if (label === "typescript" || label === "javascript") {
                    return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker.js", import.meta.url), { type: "module" });
                }
                if (label === "json") {
                    return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url), { type: "module" });
                }
                if (label === "css" || label === "scss" || label === "less") {
                    return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker.js", import.meta.url), { type: "module" });
                }
                if (label === "html" || label === "handlebars" || label === "razor") {
                    return new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker.js", import.meta.url), { type: "module" });
                }
                return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), { type: "module" });
            }
        };
        workersConfigured = true;
    }
    getTypeScriptLanguageService(monaco).configureDefaults();
}
export function toMonacoPath(filePath) {
    if (filePath.startsWith("file://")) {
        return filePath;
    }
    const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    return `file:///${normalized}`;
}
//# sourceMappingURL=monaco-setup.js.map