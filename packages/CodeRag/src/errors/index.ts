export class CodeRagError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code = "CODERAG_ERROR", details?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, options);
    this.name = "CodeRagError";
    this.code = code;
    this.details = details;
  }
}

export class ConfigurationError extends CodeRagError {
  constructor(message: string, details?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, "CONFIGURATION_ERROR", details, options);
    this.name = "ConfigurationError";
  }
}

export class IndexingError extends CodeRagError {
  constructor(message: string, details?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, "INDEXING_ERROR", details, options);
    this.name = "IndexingError";
  }
}

export class TransportError extends CodeRagError {
  constructor(message: string, details?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, "TRANSPORT_ERROR", details, options);
    this.name = "TransportError";
  }
}

export class NotFoundError extends CodeRagError {
  constructor(message: string, details?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, "NOT_FOUND", details, options);
    this.name = "NotFoundError";
  }
}
