import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () => {
    const MockMonaco = (props: { height?: string }) => (
      <div data-height={props.height ?? ""} data-testid="mock-monaco-editor" />
    );

    return MockMonaco;
  }
}));

import { CodeEditor } from "@/components/code-editor";

describe("CodeEditor", () => {
  it("applies an explicit shell height when the editor should fill its parent", () => {
    const { container } = render(
      <CodeEditor
        height="100%"
        onChange={() => undefined}
        path="tsconfig.json"
        value='{"compilerOptions":{}}'
      />
    );

    const shell = container.querySelector(".code-editor-shell");
    expect(shell).not.toBeNull();
    expect(shell).toHaveStyle({ height: "100%", minHeight: "0" });
    expect(screen.getByTestId("mock-monaco-editor")).toHaveAttribute("data-height", "100%");
  });

  it("keeps fixed-height editors pinned to their configured height", () => {
    const { container } = render(
      <CodeEditor
        height="28rem"
        onChange={() => undefined}
        path="src/example.ts"
        value="export const example = true;"
      />
    );

    const shell = container.querySelector(".code-editor-shell");
    expect(shell).not.toBeNull();
    expect(shell).toHaveStyle({ height: "28rem", minHeight: "28rem" });
  });
});
