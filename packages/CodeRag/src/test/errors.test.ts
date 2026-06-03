import { describe, expect, it } from "vitest";

import {
  CodeRagError,
  ConfigurationError,
  IndexingError,
  NotFoundError,
  TransportError
} from "../errors/index.js";

describe("structured errors", () => {
  it("exposes error metadata and subclass codes", () => {
    const baseError = new CodeRagError("base", "BASE", { ok: true });
    const configurationError = new ConfigurationError("config");
    const indexingError = new IndexingError("index");
    const transportError = new TransportError("transport");
    const notFoundError = new NotFoundError("missing");

    expect(baseError.code).toBe("BASE");
    expect(baseError.details).toEqual({ ok: true });
    expect(configurationError.code).toBe("CONFIGURATION_ERROR");
    expect(indexingError.code).toBe("INDEXING_ERROR");
    expect(transportError.code).toBe("TRANSPORT_ERROR");
    expect(notFoundError.code).toBe("NOT_FOUND");
  });
});
