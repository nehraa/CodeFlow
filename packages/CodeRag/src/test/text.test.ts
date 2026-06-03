import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  embedTextDeterministically,
  lexicalOverlapScore,
  tokenize,
  tokenizeMeaningfully,
  tokensRoughlyMatch,
  uniqueNumbers,
  weightedTokenScore
} from "../utils/text.js";

describe("text utilities", () => {
  it("normalizes and tokenizes compound identifiers", () => {
    expect(tokenize("analyzeTypeScriptRepo handles files")).toEqual([
      "analyz",
      "type",
      "script",
      "repo",
      "handl",
      "fil"
    ]);
  });

  it("drops stop words from meaningful tokenization", () => {
    expect(tokenizeMeaningfully("where is auth handled")).toEqual(["auth", "handl"]);
  });

  it("matches tokens by exact or strong prefix similarity", () => {
    expect(tokensRoughlyMatch("handl", "handle")).toBe(true);
    expect(tokensRoughlyMatch("handl", "handler")).toBe(false);
    expect(tokensRoughlyMatch("repo", "file")).toBe(false);
  });

  it("builds normalized deterministic embeddings", () => {
    const vector = embedTextDeterministically("auth auth repo", 8);
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    expect(vector).toHaveLength(8);
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("returns a zero vector for empty deterministic embeddings", () => {
    expect(embedTextDeterministically("", 4)).toEqual([0, 0, 0, 0]);
  });

  it("calculates cosine similarity and rejects mismatched vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 0])).toThrow("Cosine similarity requires vectors of equal length.");
  });

  it("treats sparse vector slots as zeros", () => {
    const left = new Array<number>(2);
    left[1] = 1;
    const right = new Array<number>(2);
    right[1] = 1;

    expect(cosineSimilarity(left, right)).toBe(1);
  });

  it("calculates lexical overlap and weighted token coverage", () => {
    expect(lexicalOverlapScore("where is auth handled", "requireAuth handles tokens")).toBe(1);
    expect(weightedTokenScore(["auth", "handl"], ["auth", "handle", "repo"])).toBe(1);
  });

  it("returns zero lexical scores for empty inputs", () => {
    expect(lexicalOverlapScore("", "candidate")).toBe(0);
    expect(weightedTokenScore([], ["candidate"])).toBe(0);
  });

  it("deduplicates and sorts numeric lists", () => {
    expect(uniqueNumbers([3, 1, 3, 2])).toEqual([1, 2, 3]);
  });
});
