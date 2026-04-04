/**
 * API Key Validation Component
 * Shows validation status and model selection dropdown
 */

import { useCallback, useEffect, useState } from "react";
import { validateAndFetchModels } from "@/lib/opencode/modelFetcher";
import type { OpencodeProvider } from "@/lib/opencode/types";

type Props = {
  provider: OpencodeProvider;
  apiKey: string;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
};

export type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export function ApiKeyValidator({
  provider,
  apiKey,
  selectedModel,
  onModelChange,
}: Props) {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validatingKey, setValidatingKey] = useState("");

  // Debounced validation
  useEffect(() => {
    if (!apiKey || apiKey.length < 10) {
      setStatus("idle");
      setModels([]);
      setError(null);
      return;
    }

    // Skip if we're validating the same key
    if (validatingKey === apiKey) {
      return;
    }

    const timer = setTimeout(async () => {
      setStatus("validating");
      setValidatingKey(apiKey);
      setError(null);

      const result = await validateAndFetchModels(provider, apiKey);

      if (result.valid && result.models) {
        setStatus("valid");
        setModels(result.models);
        setError(null);
        // Auto-select first model if available
        if (!selectedModel && result.models.length > 0) {
          onModelChange?.(result.models[0]);
        }
      } else {
        setStatus("invalid");
        setModels([]);
        setError(result.error || "Validation failed");
      }
    }, 800); // Debounce for 800ms

    return () => clearTimeout(timer);
  }, [apiKey, provider, selectedModel, validatingKey, onModelChange]);

  // Status indicator colors
  const getStatusColor = () => {
    switch (status) {
      case "validating":
        return "#f59e0b"; // amber
      case "valid":
        return "#10b981"; // green
      case "invalid":
        return "#ef4444"; // red
      default:
        return "#9ca3af"; // gray
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "validating":
        return "Validating...";
      case "valid":
        return `Valid ✓ (${models.length} models)`;
      case "invalid":
        return `Invalid ✗`;
      default:
        return "Enter API key";
    }
  };

  return (
    <div style={{ marginTop: "12px" }}>
      {/* Status indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: getStatusColor(),
          marginBottom: "8px",
          fontWeight: "500",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: getStatusColor(),
          }}
        />
        {getStatusText()}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            padding: "8px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            marginBottom: "8px",
          }}
        >
          {error}
        </div>
      )}

      {/* Model dropdown */}
      {status === "valid" && models.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: "500",
              marginBottom: "4px",
              color: "#374151",
            }}
          >
            Model
          </label>
          <select
            value={selectedModel || models[0]}
            onChange={(e) => onModelChange?.(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "12px",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
