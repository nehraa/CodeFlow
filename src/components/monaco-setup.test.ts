import { afterEach, describe, expect, it, vi } from "vitest";

const configureDefaultsMock = vi.fn();

vi.mock("@/components/ts-language-service", () => ({
  getTypeScriptLanguageService: vi.fn(() => ({
    configureDefaults: configureDefaultsMock
  }))
}));

import { prepareMonaco } from "@/components/monaco-setup";

afterEach(() => {
  configureDefaultsMock.mockReset();
  vi.unstubAllGlobals();
});

describe("prepareMonaco", () => {
  it("routes language labels to the correct Monaco workers", () => {
    class WorkerMock {
      constructor(url: URL, options: { type: string }) {
        workerSpy(url, options);
      }
    }
    const workerSpy = vi.fn();
    vi.stubGlobal("Worker", WorkerMock as unknown as typeof Worker);

    prepareMonaco({ languages: {} } as never);

    const environment = (globalThis as typeof globalThis & {
      MonacoEnvironment?: { getWorker: (_workerId: string, label: string) => unknown };
    }).MonacoEnvironment;

    expect(environment).toBeDefined();
    environment?.getWorker("1", "typescript");
    environment?.getWorker("2", "json");
    environment?.getWorker("3", "html");
    environment?.getWorker("4", "css");
    environment?.getWorker("5", "plaintext");

    expect(workerSpy.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ts.worker.js"),
        expect.stringContaining("json.worker.js"),
        expect.stringContaining("html.worker.js"),
        expect.stringContaining("css.worker.js"),
        expect.stringContaining("editor.worker.js")
      ])
    );
    expect(configureDefaultsMock).toHaveBeenCalledTimes(1);
  });
});
