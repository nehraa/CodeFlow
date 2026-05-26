import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import type { NavigationTarget } from "../lib/node-navigation.js";
type CodeEditorProps = {
    path: string;
    value: string;
    onChange: (value: string) => void;
    language?: "typescript" | "javascript" | "json" | "markdown";
    height?: string;
    ariaLabel?: string;
    readOnly?: boolean;
    theme?: "light" | "dark";
    onSave?: () => void | Promise<void>;
    revealTarget?: NavigationTarget | null;
    completionContext?: {
        enabled: boolean;
        graph: BlueprintGraph;
        nodeId: string;
        nvidiaApiKey?: string;
        retrievalQuery?: string;
        retrievalDepth?: number;
    };
};
export declare function CodeEditor({ path, value, onChange, language, height, ariaLabel, readOnly, theme, onSave, revealTarget, completionContext }: CodeEditorProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=code-editor.d.ts.map