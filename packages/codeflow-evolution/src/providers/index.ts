import "dotenv/config";
import type { GhostNode } from "../schema.js";
import type { BlueprintGraph } from "../schema.js";
import { OpenAIGhostProvider } from "./openai.js";
import { AnthropicGhostProvider } from "./anthropic.js";
import { NvidiaGhostProvider } from "./nvidia.js";
import { OllamaGhostProvider } from "./ollama.js";

export type GhostProvider = {
  suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
};

export function getGhostProvider(): GhostProvider {
  const provider = process.env.GHOST_PROVIDER ?? "openai";
  switch (provider) {
    case "openai":
      return new OpenAIGhostProvider();
    case "anthropic":
      return new AnthropicGhostProvider();
    case "nvidia":
      return new NvidiaGhostProvider();
    case "ollama":
      return new OllamaGhostProvider();
    default:
      return new OpenAIGhostProvider();
  }
}