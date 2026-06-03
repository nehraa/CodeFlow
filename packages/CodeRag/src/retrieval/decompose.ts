import type { LlmTransport, MultiHopConfig } from "../types.js";

const MULTI_TOPIC_KEYWORDS = [
  "how does",
  "compare",
  "difference",
  "relationship",
  "what are",
  "list all",
  "architecture",
  "overview",
  "explain",
  "walk through"
];

const DECOMPOSE_SYSTEM_PROMPT = `You are a query decomposition assistant. Your job is to break complex code questions into 2-5 focused sub-questions, each answerable by a specific function, class, module, or file.

Rules:
- Each sub-question should be specific enough to map to a single code element.
- Preserve the original intent across all sub-questions.
- Return ONLY a valid JSON array of strings, nothing else.
- Do not exceed 5 sub-questions.`;

const DECOMPOSE_USER_TEMPLATE = (question: string, maxSubQuestions: number): string =>
  `Break this code question into ${Math.min(maxSubQuestions, 5)} focused sub-questions.\n\nQuestion: "${question}"\n\nReturn ONLY a JSON array of sub-questions, nothing else.`;

/**
 * Heuristic classifier: returns true if the question likely benefits from decomposition.
 */
export const shouldDecompose = (question: string, config: MultiHopConfig): boolean => {
  if (question.length < config.minQuestionLength) {
    return false;
  }

  const lower = question.toLowerCase();
  let score = 0;

  if (/\b(and|vs|versus)\b/.test(lower)) {
    score += 1;
  }

  const questionMarks = (question.match(/\?/g) ?? []).length;
  if (questionMarks > 1) {
    score += 1;
  }

  const wordCount = question.split(/\s+/).length;
  if (wordCount > 25) {
    score += 1;
  }

  const hasMultiTopicKeyword = MULTI_TOPIC_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasMultiTopicKeyword) {
    score += 1;
  }

  // Require at least 2 indicators to trigger decomposition
  return score >= 2;
};

/**
 * Ask the LLM to decompose a question into sub-questions.
 * Returns the parsed JSON array or null if parsing fails.
 */
export const decomposeQuestion = async (
  question: string,
  llmTransport: LlmTransport,
  maxSubQuestions: number,
  model?: string
): Promise<string[] | null> => {
  try {
    const response = await llmTransport.generate({
      question,
      model,
      stream: false,
      context: {
        question,
        answerMode: "context-only" as const,
        retrievalMode: "single" as const,
        primaryNode: null,
        relatedNodes: [],
        graphSummary: "",
        warnings: []
      },
      messages: [
        { role: "system", content: DECOMPOSE_SYSTEM_PROMPT },
        { role: "user", content: DECOMPOSE_USER_TEMPLATE(question, maxSubQuestions) }
      ]
    });

    const raw = response.answer.trim();
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;

    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string" && item.trim().length > 0)) {
      const subQuestions = parsed as string[];
      // Cap at maxSubQuestions and minimum 2
      if (subQuestions.length < 2) {
        return null;
      }
      return subQuestions.slice(0, maxSubQuestions);
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Full decomposition pipeline: check heuristic, then ask LLM.
 * Returns sub-questions or null if decomposition should not proceed or fails.
 */
export const decomposeQuestionWithFallback = async (
  question: string,
  llmTransport: LlmTransport | undefined,
  config: MultiHopConfig,
  model?: string
): Promise<string[] | null> => {
  if (!config.enabled || !llmTransport) {
    return null;
  }

  if (!shouldDecompose(question, config)) {
    return null;
  }

  return decomposeQuestion(question, llmTransport, config.maxSubQuestions, model);
};
