import fs from "node:fs/promises";
import path from "node:path";

import type { EmbeddingProvider, Logger } from "../types.js";
import { ConfigurationError } from "../errors/index.js";
import { fileExists } from "../utils/filesystem.js";

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_MODEL_DIR = ".coderag-models/models";

export interface OnnxEmbeddingConfig {
  modelDir?: string;
  logger?: Logger;
}

interface TensorLike {
  data: Float32Array;
  dims: number[];
}

let pipelineInstance: ((input: string | string[]) => Promise<TensorLike>) | undefined = undefined;
let initializedModelDir: string | undefined = undefined;

const modelFilesExist = async (modelPath: string): Promise<boolean> => {
  const requiredFiles = ["tokenizer.json", "config.json", "onnx/model_quantized.onnx"];
  const results = await Promise.all(
    requiredFiles.map((file) => fileExists(path.join(modelPath, file)))
  );
  return results.every(Boolean);
};

const getPipeline = async (modelDir: string, logger?: Logger) => {
  if (pipelineInstance) {
    if (initializedModelDir !== modelDir) {
      throw new ConfigurationError(
        "ONNX embedding provider model directory cannot be changed after initialization."
      );
    }
    return pipelineInstance;
  }

  const mod = await import("@xenova/transformers");

  const modelPath = path.join(modelDir, DEFAULT_MODEL);
  const hasLocalModel = await modelFilesExist(modelPath);

  if (!hasLocalModel) {
    logger?.info("ONNX embedding model not found locally, downloading to", { modelPath });
  }

  mod.env.allowRemoteModels = true;

  mod.env.localModelPath = modelDir;

  // Limit WASM threads to reduce memory pressure
  mod.env.backends.onnx.wasm.numThreads = 1;

  const extractor = await mod.pipeline("feature-extraction", DEFAULT_MODEL, {
    quantized: true
  }) as (input: string | string[]) => Promise<TensorLike>;

  pipelineInstance = extractor;
  initializedModelDir = modelDir;
  return extractor;
};

const meanPool = (data: Float32Array, dims: number[]): number[] => {
  // Input shape: [batch, seq_len, hidden]
  const batchSize = dims[0] ?? 1;
  const seqLen = dims[1] ?? 1;
  const hiddenSize = dims[2] ?? DEFAULT_DIMENSIONS;

  if (batchSize !== 1) {
    throw new Error(`Expected batch size 1, got ${batchSize}`);
  }

  const result = new Float32Array(hiddenSize);
  // Sum over sequence length — no null checks needed, tensor data is dense
  for (let i = 0; i < seqLen; i += 1) {
    const offset = i * hiddenSize;
    for (let j = 0; j < hiddenSize; j += 1) {
      result[j] = result[j]! + data[offset + j]!;
    }
  }

  // Average over sequence length
  const invSeqLen = 1 / seqLen;
  for (let j = 0; j < hiddenSize; j += 1) {
    result[j] = result[j]! * invSeqLen;
  }

  return Array.from(result);
};

export class OnnxEmbeddingProvider implements EmbeddingProvider {
  readonly name = "onnx" as const;
  readonly model = DEFAULT_MODEL;
  readonly dimensions = DEFAULT_DIMENSIONS;
  readonly maxBatchSize = 1; // One at a time to minimize memory pressure
  readonly maxInputTokens = 256; // all-MiniLM-L6-v2 max sequence length
  private readonly modelDir: string;
  private readonly logger?: Logger;

  constructor(config?: OnnxEmbeddingConfig) {
    this.modelDir = config?.modelDir ?? DEFAULT_MODEL_DIR;
    this.logger = config?.logger;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await getPipeline(this.modelDir, this.logger);
    const result = await extractor(text);
    return meanPool(result.data, result.dims);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const extractor = await getPipeline(this.modelDir, this.logger);
    this.logger?.debug("ONNX embedBatch", { count: texts.length });
    const result = await extractor(texts);
    const data = result.data;
    const dims = result.dims;

    // Shape: [batch, seq_len, hidden]
    const batchSize = dims[0] ?? 1;
    const seqLen = dims[1] ?? 1;
    const hiddenSize = dims[2] ?? DEFAULT_DIMENSIONS;
    const embeddings: number[][] = [];

    for (let b = 0; b < batchSize; b += 1) {
      const sum = new Float32Array(hiddenSize);
      const batchOffset = b * seqLen * hiddenSize;
      for (let s = 0; s < seqLen; s += 1) {
        const seqOffset = batchOffset + s * hiddenSize;
        for (let h = 0; h < hiddenSize; h += 1) {
          sum[h] = sum[h]! + data[seqOffset + h]!;
        }
      }
      const invSeqLen = 1 / seqLen;
      for (let h = 0; h < hiddenSize; h += 1) {
        sum[h] = sum[h]! * invSeqLen;
      }
      embeddings.push(Array.from(sum));
    }

    return embeddings;
  }
}
