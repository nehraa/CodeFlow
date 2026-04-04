# File I/O API Design Document

## Overview

Secure file I/O endpoints for Next.js App Router with comprehensive path traversal protection, extension whitelisting, and streaming support for large files.

---

## Endpoints

### 1. GET /api/files/get

Read file contents with optional streaming for large files.

#### Request

**Query Parameters:**

| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| path      | string | Yes      | Relative path from repo root to file  |

**Example:** `GET /api/files/get?path=src/components/Button.tsx`

#### Response

**Success (file ≤ 500KB):**

```json
{
  "success": true,
  "data": {
    "path": "src/components/Button.tsx",
    "content": "import React...",
    "size": 1024,
    "encoding": "utf8",
    "isStreamed": false
  }
}
```

**Success (file > 500KB - streamed):**

- HTTP Status: 200 OK
- Content-Type: application/octet-stream
- Transfer-Encoding: chunked
- Body: Raw file bytes

**Error Response Structure:** All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERR_{ERROR_CODE}",
    "message": "Human-readable error description",
    "details": {} // Additional context when applicable
  }
}
```

**Error Codes:**

| HTTP Status | Error Code           | Description                           |
|-------------|----------------------|---------------------------------------|
| 400         | ERR_EMPTY_PATH       | Path parameter is empty               |
| 400         | ERR_ABSOLUTE_PATH    | Absolute paths are not allowed        |
| 400         | ERR_INVALID_PATH     | Path contains invalid characters      |
| 400         | ERR_PATH_ESCAPE      | Path attempts directory traversal     |
| 400         | ERR_DISALLOWED_EXT   | File extension not in whitelist       |
| 404         | ERR_FILE_NOT_FOUND   | File does not exist                   |
| 400         | ERR_IS_DIRECTORY     | Path points to a directory, not file  |
| 500         | ERR_INTERNAL         | Unexpected server error             |

---

### 2. POST /api/files/post

Write file contents with validation and security checks.

#### Request

**Headers:**

| Header         | Value            | Required |
|----------------|------------------|----------|
| Content-Type   | application/json | Yes      |

**Body Schema:**

```json
{
  "path": "src/components/Button.tsx",      // string, required
  "content": "import React...",              // string, required
  "encoding": "utf8"                         // string, optional, default: "utf8"
}
```

#### Response

**Success (201 Created):**

```json
{
  "success": true,
  "data": {
    "path": "src/components/Button.tsx",
    "bytesWritten": 1024,
    "created": false,
    "encoding": "utf8"
  }
}
```

**Error Response Structure:** Same as GET endpoint.

**Error Codes:**

| HTTP Status | Error Code           | Description                           |
|-------------|----------------------|---------------------------------------|
| 400         | ERR_EMPTY_PATH       | Path parameter is empty               |
| 400         | ERR_ABSOLUTE_PATH    | Absolute paths are not allowed        |
| 400         | ERR_INVALID_PATH     | Path contains invalid characters      |
| 400         | ERR_PATH_ESCAPE      | Path attempts directory traversal     |
| 400         | ERR_DISALLOWED_EXT   | File extension not in whitelist       |
| 404         | ERR_PARENT_NOT_FOUND | Parent directory does not exist       |
| 413         | ERR_PAYLOAD_TOO_LARGE| Content exceeds max size (10MB)       |
| 400         | ERR_INVALID_JSON     | Request body is not valid JSON        |
| 400         | ERR_VALIDATION_ERROR | Zod schema validation failed          |
| 500         | ERR_INTERNAL         | Unexpected server error             |

---

## Request/Response Schemas (Zod)

### GET Request Schema

```typescript
const getFileQuerySchema = z.object({
  path: z.string()
    .min(1, "Path is required")
    .refine(p => !isAbsolute(p), "Absolute paths are not allowed")
});

type GetFileQueryRequest = z.infer<typeof getFileQuerySchema>;
```

### GET Response Schema

```typescript
const fileGetResponseDataSchema = z.object({
  path: z.string(),
  content: z.string(),
  size: z.number().int().nonnegative(),
  encoding: z.string(),
  isStreamed: z.boolean()
});

const fileGetSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: fileGetResponseDataSchema
});

type FileGetSuccessResponse = z.infer<typeof fileGetSuccessResponseSchema>;
```

### POST Request Schema

```typescript
const writeFileBodySchema = z.object({
  path: z.string()
    .min(1, "Path is required")
    .refine(p => !isAbsolute(p), "Absolute paths are not allowed"),
  content: z.string(),
  encoding: z.enum(["utf8", "ascii", "base64", "latin1"]).default("utf8")
});

type WriteFileBodyRequest = z.infer<typeof writeFileBodySchema>;
```

### POST Response Schema

```typescript
const fileWriteResponseDataSchema = z.object({
  path: z.string(),
  bytesWritten: z.number().int().nonnegative(),
  created: z.boolean(),
  encoding: z.string()
});

const fileWriteSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: fileWriteResponseDataSchema
});

type FileWriteSuccessResponse = z.infer<typeof fileWriteSuccessResponseSchema>;
```

### Shared Error Schema

```typescript
const fileErrorCodeSchema = z.enum([
  "ERR_EMPTY_PATH",
  "ERR_ABSOLUTE_PATH",
  "ERR_INVALID_PATH",
  "ERR_PATH_ESCAPE",
  "ERR_DISALLOWED_EXTENSION",
  "ERR_FILE_NOT_FOUND",
  "ERR_IS_DIRECTORY",
  "ERR_PARENT_NOT_FOUND",
  "ERR_PAYLOAD_TOO_LARGE",
  "ERR_INVALID_JSON",
  "ERR_VALIDATION_ERROR",
  "ERR_INTERNAL"
]);

const fileErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: fileErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })
});

type FileErrorResponse = z.infer<typeof fileErrorSchema>;
```

---

## Security Validation Flow

### Phase 1: Input Validation (Zod Schema)

1. **Parse and validate request body/query** using Zod schemas
2. **Check path is non-empty** - reject EMPTY_PATH
3. **Check path is relative** - reject ABSOLUTE_PATH
4. **Check content size** (POST only) - reject PAYLOAD_TOO_LARGE (>10MB)

### Phase 2: Path Security Validation

```
┌─────────────────────────────────────────────────────────────┐
│                    validateFilePath()                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Normalize path (resolve ., .., multiple slashes)        │
│    └─ Use path.normalize() then path.posix.normalize()     │
│                                                              │
│ 2. Verify no null bytes (\x00)                              │
│    └─ Reject: INVALID_PATH                                  │
│                                                              │
│ 3. Check for path traversal patterns                        │
│    └─ Contains ".." after NORMALIZATION                     │
│    └─ Reject: PATH_ESCAPE   ┐                              │
│        Starting with "/"   ──┤                              │
│    └─ Reject: ABSOLUTE_PATH                                    │
│                                                              │
│ 4. Resolve to absolute path                                 │
│    └─ resolved = path.join(CODEFLOW_REPO_ROOT, path)        │
│                                                              │
│ 5. Verify resolved path is within repo root                 │
│    └─ !resolved.startsWith(CODEFLOW_REPO_ROOT)              │
│    └─ Reject: PATH_ESCAPE                                   │
│                                                              │
│ 6. Validate file extension (GET and POST)                   │
│    └─ ext = path.extname(filename).toLowerCase()            │
│    └─ !ALLOWED_EXTENSIONS.has(ext)                          │
│    └─ Reject: DISALLOWED_EXTENSION                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: File System Validation (GET)

```
┌─────────────────────────────────────────────────────────────┐
│                    validateFileExists()                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Check existence                                            │
│    └─ !existsSync(resolvedPath)                               │
│    └─ Reject: FILE_NOT_FOUND                                  │
│                                                              │
│ 2. Check is regular file (not directory)                      │
│    └─ statSync(resolvedPath).isDirectory()                    │
│    └─ Reject: IS_DIRECTORY                                    │
│                                                              │
│ 3. Check readability                                        │
│    └─ accessSync(resolvedPath, R_OK)                        │
│    └─ Reject: INTERNAL (permission denied)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: File System Validation (POST)

```
┌─────────────────────────────────────────────────────────────┐
│                    validateWriteOperation()                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Check parent directory exists                              │
│    └─ parentDir = dirname(resolvedPath)                     │
│    └─ !existsSync(parentDir)                                  │
│    └─ Reject: PARENT_NOT_FOUND                                │
│                                                              │
│ 2. Check parent is a directory                                │
│    └─ !statSync(parentDir).isDirectory()                    │
│    └─ Reject: PARENT_NOT_FOUND                                │
│                                                              │
│ 3. Check write permissions (if file exists)                 │
│    └─ existsSync(resolvedPath)                               │
│    └─ accessSync(resolvedPath, W_OK)                        │
│    └─ Reject: INTERNAL (permission denied)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Constants

### Environment Variables

| Variable           | Required | Default | Description                         |
|--------------------|----------|---------|-------------------------------------|
| CODEFLOW_REPO_ROOT | Yes      | -       | Absolute path to repository root    |

### Security Constants

```typescript
// File size threshold for streaming (500KB)
const STREAMING_THRESHOLD_BYTES = 500 * 1024;

// Maximum write payload size (10MB)
const MAX_WRITE_SIZE_BYTES = 10 * 1024 * 1024;

// Allowed file extensions (whitelist approach)
const ALLOWED_EXTENSIONS = new Set([
  // TypeScript/JavaScript
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  // Styles
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
  // Configuration
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".config",
  // Markup
  ".html",
  ".htm",
  ".md",
  ".mdx",
  ".vue",
  ".svelte",
  // Documentation
  ".txt",
  ".rst",
  ".adoc",
  // Data
  ".csv",
  ".xml",
  ".svg",
  // Shell/Scripts
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  // Other
  ".gitignore",
  ".dockerignore",
  ".editorconfig"
]);

// Forbidden path patterns (regex)
const FORBIDDEN_PATTERNS = [
  /\x00/,                          // Null bytes
  /\/\.\./,                        // Relative parent at root
  /^(?:\/|\\|[a-zA-Z]:)/           // Absolute path patterns
];
```

---

## TypeScript Interfaces

```typescript
// src/app/api/files/types.ts

/**
 * Error codes for file operations
 */
export enum FileErrorCode {
  EMPTY_PATH = "ERR_EMPTY_PATH",
  ABSOLUTE_PATH = "ERR_ABSOLUTE_PATH",
  INVALID_PATH = "ERR_INVALID_PATH",
  PATH_ESCAPE = "ERR_PATH_ESCAPE",
  DISALLOWED_EXTENSION = "ERR_DISALLOWED_EXTENSION",
  FILE_NOT_FOUND = "ERR_FILE_NOT_FOUND",
  IS_DIRECTORY = "ERR_IS_DIRECTORY",
  PARENT_NOT_FOUND = "ERR_PARENT_NOT_FOUND",
  PAYLOAD_TOO_LARGE = "ERR_PAYLOAD_TOO_LARGE",
  INVALID_JSON = "ERR_INVALID_JSON",
  VALIDATION_ERROR = "ERR_VALIDATION_ERROR",
  INTERNAL_ERROR = "ERR_INTERNAL"
}

/**
 * File operation result wrapper
 */
export interface FileOperationResult<T> {
  success: true;
  data: T;
}

/**
 * File error response
 */
export interface FileErrorResponse {
  success: false;
  error: {
    code: FileErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * GET /api/files/get response data
 */
export interface FileGetResponseData {
  path: string;
  content: string;
  size: number;
  encoding: BufferEncoding;
  isStreamed: boolean;
}

/**
 * POST /api/files/post response data
 */
export interface FileWriteResponseData {
  path: string;
  bytesWritten: number;
  created: boolean;
  encoding: BufferEncoding;
}

/**
 * Union type for API responses
 */
export type FileGetResponse = FileOperationResult<FileGetResponseData> | FileErrorResponse;
export type FileWriteResponse = FileOperationResult<FileWriteResponseData> | FileErrorResponse;
```

---

## File Structure

```
src/app/api/files/
├── _lib/
│   ├── constants.ts      # Security constants and config
│   ├── schemas.ts        # Zod validation schemas
│   ├── security.ts       # Path validation utilities
│   ├── errors.ts         # Error classes and helpers
│   └── types.ts          # TypeScript interfaces
├── get/
│   └── route.ts          # GET /api/files/get handler
├── post/
│   └── route.ts          # POST /api/files/post handler
└── types.ts              # Re-export of public types
```

---

## Implementation Notes

### Path Normalization Strategy

Always use **defense in depth** with multiple normalization passes:

```typescript
function normalizeAndSecurePath(inputPath: string): string {
  // First: standard normalization
  let normalized = path.normalize(inputPath);

  // Second: POSIX style for consistency
  normalized = path.posix.normalize(normalized.replace(/\\/g, "/"));

  // Third: remove any leading/trailing whitespace
  normalized = normalized.trim();

  // Fourth: remove leading slashes (prevent absolute)
  normalized = normalized.replace(/^\/+/, "");

  return normalized;
}
```

### Error Handling Principles

1. **Never expose internal paths** - Log absolute paths to server logs only, never to client
2. **Never expose stack traces** - Generic internal error messages in production
3. **Consistent error format** - Always use the Zod error schema structure
4. **Appropriate HTTP status codes** - Map error codes to semantic HTTP status

### Security Best Practices

1. **Canonicalize before validation** - Always normalize path before checking extensions
2. **Whitelist, not blacklist** - Only allow known-safe extensions
3. **Double-check resolved paths** - Verify final resolved path is still under root
4. **Use file descriptor operations** - Avoid TOCTOU race conditions where possible
5. **Rate limiting** - Consider adding rate limits per IP for write operations

---

## Testing Strategy

### Security Test Cases

```typescript
// Path traversal attempts
["../etc/passwd", "../../.env", "foo/../../../secret", ".\\..\\windows\\system.ini"]

// Null byte injection
["file.txt\x00.js", "normal.txt\x00"]

// Absolute path attempts
["/etc/passwd", "C:/Windows/system.ini", "/var/www/html", "\\server\share"]

// Forbidden characters
["file<>.txt", "file|?.txt", "file:*.txt"]

// Extension bypasses
["file.js.exe", "file.txt.pdf", ".htaccess", "../config.xml"]
```

### Edge Cases

- Empty path ("")
- Current directory reference ("./file.txt")
- Multiple slashes ("///etc/passwd")
- Unicode paths ("файл.txt")
- Very long paths (>1024 chars)
- Special files (pipes, sockets, device files)
- Symlink traversal (if symlinks exist in repo)
