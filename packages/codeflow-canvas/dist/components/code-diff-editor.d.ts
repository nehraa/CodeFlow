type CodeDiffEditorProps = {
    originalValue: string;
    modifiedValue: string;
    language?: "typescript" | "javascript" | "json" | "markdown";
    height?: string;
    readOnly?: boolean;
    theme?: "light" | "dark";
    onModifiedChange?: (value: string) => void;
};
export declare function CodeDiffEditor({ originalValue, modifiedValue, language, height, readOnly, theme, onModifiedChange }: CodeDiffEditorProps): React.JSX.Element;
export {};
//# sourceMappingURL=code-diff-editor.d.ts.map