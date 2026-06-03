const TOKEN_PATTERN = /[A-Za-z0-9_]+/g;

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "where",
  "which",
  "who",
  "why"
]);

const splitCompoundToken = (token: string): string[] =>
  token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_]+/)
    .map((part) => part.toLowerCase())
    .filter(Boolean);

const trimSuffix = (token: string): string => {
  if (token.length <= 4) {
    return token;
  }

  if (token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("ing")) {
    return token.slice(0, -3);
  }

  if (token.endsWith("ed")) {
    return token.slice(0, -2);
  }

  if (token.endsWith("es")) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
};

const trimTrailingE = (token: string): string => {
  if (token.length <= 5 || !token.endsWith("e")) {
    return token;
  }

  return token.slice(0, -1);
};

const normalizeToken = (token: string): string => trimTrailingE(trimSuffix(token.toLowerCase()));

const tokenizeWith = (text: string, predicate: (token: string) => boolean): string[] => {
  const matches = text.match(TOKEN_PATTERN);
  if (!matches) {
    return [];
  }

  return matches
    .flatMap(splitCompoundToken)
    .map(normalizeToken)
    .filter(predicate);
};

const countPrefixMatch = (left: string, right: string): number => {
  const maxLength = Math.min(left.length, right.length);
  let index = 0;

  while (index < maxLength && left[index] === right[index]) {
    index += 1;
  }

  return index;
};

const findMatch = (candidateTokens: string[], queryToken: string): string | undefined =>
  candidateTokens.find((candidateToken) => tokensRoughlyMatch(queryToken, candidateToken));

export const tokenize = (text: string): string[] => tokenizeWith(text, Boolean);

export const tokenizeMeaningfully = (text: string): string[] =>
  tokenizeWith(text, (token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));

export const tokensRoughlyMatch = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }

  if (Math.abs(left.length - right.length) > 1) {
    return false;
  }

  const prefixLength = countPrefixMatch(left, right);
  return prefixLength >= 4 && prefixLength >= Math.min(left.length, right.length) - 1;
};

export const embedTextDeterministically = (text: string, dimensions: number): number[] => {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = tokenizeMeaningfully(text);

  for (const token of tokens) {
    const bucket = hashToken(token) % dimensions;
    vector[bucket] = vector[bucket]! + 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
};

const hashToken = (token: string): number => {
  let value = 2166136261;
  for (const character of token) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
};

export const cosineSimilarity = (left: number[], right: number[]): number => {
  if (left.length !== right.length) {
    throw new Error("Cosine similarity requires vectors of equal length.");
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

export const lexicalOverlapScore = (query: string, candidate: string): number => {
  const queryTokens = tokenizeMeaningfully(query);
  const candidateTokens = tokenizeMeaningfully(candidate);
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const matchedTokens = queryTokens.filter((queryToken) => Boolean(findMatch(candidateTokens, queryToken)));
  return matchedTokens.length / queryTokens.length;
};

export const weightedTokenScore = (queryTokens: string[], candidateTokens: string[]): number => {
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const uniqueQueryTokens = [...new Set(queryTokens)];
  const matched = uniqueQueryTokens.filter((queryToken) => Boolean(findMatch(candidateTokens, queryToken)));
  return matched.length / uniqueQueryTokens.length;
};

export const uniqueNumbers = (values: number[]): number[] => [...new Set(values)].sort((left, right) => left - right);
