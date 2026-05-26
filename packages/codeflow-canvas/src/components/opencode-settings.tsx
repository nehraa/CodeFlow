"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpencodeProvider, OpencodeServerInfo } from "../lib/types.js";

const PROVIDERS: { id: OpencodeProvider; label: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai", label: "OpenAI (GPT)" },
  { id: "google", label: "Google (Gemini)" },
  { id: "azure", label: "Azure OpenAI" },
  { id: "groq", label: "Groq" },
  { id: "mistral", label: "Mistral" },
  { id: "cohere", label: "Cohere" },
  { id: "perplexity", label: "Perplexity" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "bedrock", label: "AWS Bedrock" },
  { id: "local", label: "Local Model" },
];

type Props = {
  onClose?: () => void;
  onStatusChange?: (status: OpencodeServerInfo) => void;
};

export function OpencodeSettings({ onClose, onStatusChange }: Props) {
  const [provider, setProvider] = useState<OpencodeProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [serverStatus, setServerStatus] = useState<OpencodeServerInfo>({ status: "stopped" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="opencode-settings">
      <div className="opencode-settings-header">
        <h3>OpenCode Agent Settings</h3>
        {onClose && (
          <button onClick={onClose} type="button" className="close-btn">
            ×
          </button>
        )}
      </div>

      <div className="server-status-bar">
        <span className={`status-indicator status-${serverStatus.status}`} />
        <span className="status-text">
          {serverStatus.status === "running"
            ? `Connected (${serverStatus.url})`
            : serverStatus.status === "starting"
            ? "Starting..."
            : serverStatus.status === "error"
            ? `Error: ${serverStatus.error}`
            : "Not connected"}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <label className="field">
        <span>AI Provider</span>
        <select value={provider} onChange={(e) => setProvider(e.target.value as OpencodeProvider)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>API Key</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Enter your ${PROVIDERS.find((p) => p.id === provider)?.label || provider} API key`}
        />
      </label>
    </div>
  );
}