import { describe, expect, it, vi } from "vitest";

describe("serveHttpServer", () => {
  it("starts the server and logs the listening address", async () => {
    vi.resetModules();
    const fakeServer = {
      once: vi.fn(),
      off: vi.fn(),
      listen: vi.fn((port: number, host: string, callback: () => void) => {
        callback();
        return fakeServer;
      })
    };
    const createServer = vi.fn(() => fakeServer);

    vi.doMock("node:http", () => ({
      default: { createServer },
      createServer
    }));

    const { serveHttpServer } = await import("../service/http.js");
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const server = await serveHttpServer({} as never, {
      service: { host: "127.0.0.1", port: 4119 },
      logger
    } as never);

    expect(server).toBe(fakeServer);
    expect(fakeServer.listen).toHaveBeenCalledWith(4119, "127.0.0.1", expect.any(Function));
    expect(logger.info).toHaveBeenCalled();
  });
});
