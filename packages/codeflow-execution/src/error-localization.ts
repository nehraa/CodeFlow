/**
 * error-localization.ts
 *
 * Map errors back to specific nodes and execution steps.
 */

import type { ExecutionSpan } from "./execution-span.js";

// ── Types ────────────────────────────────────────────────────────────────────────

export interface LocalizedError {
  nodeId: string | null;
  stepIndex: number | null;
  message: string;
  stackTrace?: string;
}

// ── Core localization ─────────────────────────────────────────────────────────

/**
 * Find which node's stack trace contains the error message.
 * Returns the first matching span's nodeId and index.
 */
export const localizeError = (
  errorMessage: string,
  spans: ExecutionSpan[]
): LocalizedError => {
  if (spans.length === 0) {
    return { nodeId: null, stepIndex: null, message: errorMessage };
  }

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (span.stackTrace && span.stackTrace.includes(errorMessage)) {
      return {
        nodeId: span.nodeId,
        stepIndex: i,
        message: errorMessage,
        stackTrace: span.stackTrace
      };
    }
  }

  return { nodeId: null, stepIndex: null, message: errorMessage };
};

// ── Error context ─────────────────────────────────────────────────────────────

/**
 * Get the most relevant ExecutionSpan for a given node —
 * the most recent failed/warning span, or null if all spans are successful.
 */
export const getErrorContext = (
  spans: ExecutionSpan[],
  nodeId: string
): ExecutionSpan | null => {
  const nodeSpans = spans.filter((s) => s.nodeId === nodeId);

  if (nodeSpans.length === 0) return null;

  // Only return a span if there are failed or warning spans
  const failedOrWarning = nodeSpans.filter(
    (s) => s.status === "failed" || s.status === "warning"
  );
  if (failedOrWarning.length === 0) return null;

  return failedOrWarning[failedOrWarning.length - 1];
};

// ── Human-readable report ─────────────────────────────────────────────────────

/**
 * Build a human-readable error report from an error message and spans.
 */
export const buildErrorReport = (
  errorMessage: string,
  spans: ExecutionSpan[]
): string => {
  const localized = localizeError(errorMessage, spans);
  const lines: string[] = [`Error: ${localized.message}`];

  if (localized.nodeId !== null) {
    lines.push(`  Node: ${localized.nodeId}`);
  }
  if (localized.stepIndex !== null) {
    lines.push(`  Step: ${localized.stepIndex}`);
  }

  if (localized.nodeId === null) {
    lines.push("  Unable to localize error to a specific node.");
  }

  return lines.join("\n");
};
