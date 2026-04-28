import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface AgentReasoningStep {
  agentId: string;
  thought: string;
  action: string;
  timestamp: string;
  output?: string;
  error?: string;
}

export interface ReasoningTrace {
  sessionId: string;
  phase: string;
  projectName: string;
  steps: AgentReasoningStep[];
  startedAt: string;
  updatedAt?: string;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'node';

/**
 * Returns the store root directory, following codeflow-store conventions.
 */
function getStoreRoot(): string {
  if (process.env.CODEFLOW_STORE_ROOT) {
    return path.resolve(process.env.CODEFLOW_STORE_ROOT);
  }
  return path.join(os.homedir(), '.codeflow-store');
}

/**
 * Returns the base path for reasoning traces.
 */
function reasoningBasePath(): string {
  return path.join(getStoreRoot(), 'checkpoints', 'reasoning');
}

/**
 * Returns the file path for a reasoning trace.
 */
function reasoningTracePath(projectName: string, sessionId: string, phase: string): string {
  const base = reasoningBasePath();
  return path.join(base, slugify(projectName), `${sessionId}-${slugify(phase)}.json`);
}

/**
 * Saves a complete reasoning trace to the file system.
 */
export async function saveReasoningTrace(
  projectName: string,
  trace: ReasoningTrace
): Promise<void> {
  const filePath = reasoningTracePath(projectName, trace.sessionId, trace.phase);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(trace, null, 2), 'utf8');
}

/**
 * Appends a reasoning step to an existing trace or creates a new one.
 */
export async function appendReasoningStep(
  projectName: string,
  sessionId: string,
  phase: string,
  step: AgentReasoningStep
): Promise<void> {
  const filePath = reasoningTracePath(projectName, sessionId, phase);
  let existing: ReasoningTrace;

  try {
    const content = await fs.readFile(filePath, 'utf8');
    existing = JSON.parse(content);
  } catch {
    // Create a new trace if the file doesn't exist
    existing = {
      sessionId,
      phase,
      projectName,
      steps: [],
      startedAt: new Date().toISOString(),
    };
  }

  existing.steps.push(step);
  existing.updatedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf8');
}

/**
 * Loads a reasoning trace from the file system.
 */
export async function loadReasoningTrace(
  projectName: string,
  sessionId: string,
  phase: string
): Promise<ReasoningTrace | null> {
  const filePath = reasoningTracePath(projectName, sessionId, phase);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as ReasoningTrace;
  } catch {
    return null;
  }
}