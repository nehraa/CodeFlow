import { describe, test, expect } from "vitest";
import { getOpencodeServerInfo } from "./server";

describe("OpenCode Server", () => {
  describe("getOpencodeServerInfo", () => {
    test("returns stopped status when server is not started", () => {
      const info = getOpencodeServerInfo();
      expect(info.status).toBe("stopped");
    });

    test("returns server info object with status property", () => {
      const info = getOpencodeServerInfo();
      expect(info).toHaveProperty("status");
      expect(typeof info.status).toBe("string");
    });

    test("status is one of valid values", () => {
      const info = getOpencodeServerInfo();
      expect(["stopped", "starting", "running", "stopping", "error"]).toContain(info.status);
    });
  });
});
