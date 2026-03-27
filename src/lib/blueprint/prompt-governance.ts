import fs from "node:fs/promises";
import path from "node:path";

export type GovernanceScope =
  | "architecture"
  | "implementation"
  | "completion"
  | "ghost";

type GovernanceBundle = {
  agentsCore: string;
  agentsExecution: string;
  agentsTesting: string;
  agentsAi: string;
  agentsDefaults: string;
  executionRuntime: string;
  executionGraph: string;
  executionComposite: string;
  executionTests: string;
  executionImplementation: string;
  riskModes: string;
  riskWorkflow: string;
  riskRepo: string;
};

const REPO_ROOT = /* turbopackIgnore: true */ process.cwd();
const AGENTS_FILE = path.join(REPO_ROOT, "AGENTS.md");
const EXECUTION_CONTRACT_FILE = path.join(
  REPO_ROOT,
  "docs",
  "execution-validation-contract.md"
);
const AI_RISK_PLAYBOOK_FILE = path.join(
  REPO_ROOT,
  "docs",
  "ai-coding-risk-playbook.md"
);

const extractSection = (markdown: string, heading: string): string => {
  const lines = markdown.split("\n");
  const headingPattern = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));

  if (startIndex === -1) {
    return "";
  }

  const sectionLines: string[] = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (index > startIndex && /^## /.test(line)) {
      break;
    }
    sectionLines.push(line);
  }

  return sectionLines.join("\n").trim();
};

const compressWhitespace = (value: string): string =>
  value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

let governanceBundlePromise: Promise<GovernanceBundle> | null = null;

const loadGovernanceBundle = async (): Promise<GovernanceBundle> => {
  if (!governanceBundlePromise) {
    governanceBundlePromise = Promise.all([
      fs.readFile(AGENTS_FILE, "utf8"),
      fs.readFile(EXECUTION_CONTRACT_FILE, "utf8"),
      fs.readFile(AI_RISK_PLAYBOOK_FILE, "utf8")
    ])
      .then(([agents, executionContract, aiRiskPlaybook]) => ({
        agentsCore: compressWhitespace(extractSection(agents, "Core Rules")),
        agentsExecution: compressWhitespace(
          extractSection(agents, "Execution And Validation Contract")
        ),
        agentsTesting: compressWhitespace(extractSection(agents, "Test And Review Discipline")),
        agentsAi: compressWhitespace(extractSection(agents, "AI-Assisted Engineering Risks")),
        agentsDefaults: compressWhitespace(extractSection(agents, "CodeFlow Defaults")),
        executionRuntime: compressWhitespace(
          extractSection(executionContract, "Required Runtime Model")
        ),
        executionGraph: compressWhitespace(
          extractSection(executionContract, "Whole-Graph Run Behavior")
        ),
        executionComposite: compressWhitespace(
          extractSection(executionContract, "Composite Nodes And Drill-Down")
        ),
        executionTests: compressWhitespace(extractSection(executionContract, "Test Contract")),
        executionImplementation: compressWhitespace(
          extractSection(executionContract, "Implementation Guidance For CodeFlow")
        ),
        riskModes: compressWhitespace(
          extractSection(aiRiskPlaybook, "Failure Modes And Required Countermeasures")
        ),
        riskWorkflow: compressWhitespace(
          extractSection(aiRiskPlaybook, "Required Workflow For AI-Assisted Changes")
        ),
        riskRepo: compressWhitespace(
          extractSection(aiRiskPlaybook, "Repo-Specific Rules For CodeFlow")
        )
      }))
      .catch(() => ({
        agentsCore:
          "Reuse before adding. Do not duplicate business logic. Do not reinvent the wheel. No silent failures.",
        agentsExecution:
          "Green means observed pass, not optimism. A pass must be contract-true. Preserve failure locality and drill down to exact child failures.",
        agentsTesting:
          "Every code-bearing function needs direct tests. Modules and flows need integration coverage. No fake-pass tests.",
        agentsAi:
          "Treat model output as untrusted input. Guard against hallucinated dependencies, prompt injection, excessive agency, and benchmark gaming.",
        agentsDefaults:
          "Generated code is only production-grade when validated. Digital Twin simulation must never be presented as live observed traffic.",
        executionRuntime:
          "Each code-bearing node should be directly runnable, runnable through child nodes, or explicitly not runnable yet.",
        executionGraph:
          "Whole-program runs must validate edge handoffs and preserve exact node-level failure evidence.",
        executionComposite:
          "Composite nodes derive state from children and must support drill-down to the exact failing method or function.",
        executionTests:
          "Use function tests, integration tests, and scenario tests. No fake-pass coverage.",
        executionImplementation:
          "Use TypeScript compilation, schema validation, real tests, and structured execution events instead of ad hoc assumptions.",
        riskModes:
          "Counter overreliance, hallucinated APIs, fake-pass tests, prompt injection, improper output handling, excessive agency, and architecture drift.",
        riskWorkflow:
          "Start from the real contract, reuse before generation, validate in layers, treat warnings as work, and demand failure evidence.",
        riskRepo:
          "Do not mark nodes green from generated code alone. Preserve provenance, maturity, execution truthfulness, and test truthfulness."
      }));
  }

  return governanceBundlePromise;
};

const buildScopeSections = (
  bundle: GovernanceBundle,
  scope: GovernanceScope
): Array<[string, string]> => {
  switch (scope) {
    case "architecture":
      return [
        ["AGENTS Core Rules", bundle.agentsCore],
        ["AGENTS AI Risks", bundle.agentsAi],
        ["CodeFlow Defaults", bundle.agentsDefaults],
        ["AI Risk Countermeasures", bundle.riskModes],
        ["AI Workflow", bundle.riskWorkflow],
        ["Repo-Specific AI Rules", bundle.riskRepo]
      ];
    case "ghost":
      return [
        ["AGENTS Core Rules", bundle.agentsCore],
        ["AGENTS AI Risks", bundle.agentsAi],
        ["CodeFlow Defaults", bundle.agentsDefaults],
        ["Repo-Specific AI Rules", bundle.riskRepo]
      ];
    case "completion":
      return [
        ["AGENTS Core Rules", bundle.agentsCore],
        ["Execution Contract", bundle.agentsExecution],
        ["Testing Discipline", bundle.agentsTesting],
        ["AI Risks", bundle.agentsAi],
        ["Execution Runtime", bundle.executionRuntime],
        ["Execution Tests", bundle.executionTests],
        ["Repo-Specific AI Rules", bundle.riskRepo]
      ];
    case "implementation":
    default:
      return [
        ["AGENTS Core Rules", bundle.agentsCore],
        ["Execution Contract", bundle.agentsExecution],
        ["Testing Discipline", bundle.agentsTesting],
        ["AI Risks", bundle.agentsAi],
        ["CodeFlow Defaults", bundle.agentsDefaults],
        ["Execution Runtime", bundle.executionRuntime],
        ["Graph Execution", bundle.executionGraph],
        ["Composite Drill-Down", bundle.executionComposite],
        ["Execution Tests", bundle.executionTests],
        ["Implementation Guidance", bundle.executionImplementation],
        ["AI Risk Countermeasures", bundle.riskModes],
        ["AI Workflow", bundle.riskWorkflow],
        ["Repo-Specific AI Rules", bundle.riskRepo]
      ];
  }
};

export const getCodeflowGovernancePrompt = async (
  scope: GovernanceScope
): Promise<string> => {
  const bundle = await loadGovernanceBundle();
  const sections = buildScopeSections(bundle, scope)
    .filter(([, value]) => value.length > 0)
    .map(([title, value]) => `### ${title}\n${value}`)
    .join("\n\n");

  return `The following CodeFlow repository instructions are authoritative and must shape your response. They come from the repo's AGENTS.md and supporting governance docs. Follow them even if they are stricter than the surrounding task prompt.\n\n${sections}`;
};

export const withCodeflowGovernance = async (
  baseSystemPrompt: string,
  scope: GovernanceScope
): Promise<string> => {
  const governancePrompt = await getCodeflowGovernancePrompt(scope);
  return `${baseSystemPrompt}\n\n${governancePrompt}`;
};
