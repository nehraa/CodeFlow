"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const PROVIDERS = [
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
export function OpencodeSettings({ onClose, onStatusChange }) {
    const [provider, setProvider] = useState("anthropic");
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [serverStatus, setServerStatus] = useState({ status: "stopped" });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    return (_jsxs("div", { className: "opencode-settings", children: [_jsxs("div", { className: "opencode-settings-header", children: [_jsx("h3", { children: "OpenCode Agent Settings" }), onClose && (_jsx("button", { onClick: onClose, type: "button", className: "close-btn", children: "\u00D7" }))] }), _jsxs("div", { className: "server-status-bar", children: [_jsx("span", { className: `status-indicator status-${serverStatus.status}` }), _jsx("span", { className: "status-text", children: serverStatus.status === "running"
                            ? `Connected (${serverStatus.url})`
                            : serverStatus.status === "starting"
                                ? "Starting..."
                                : serverStatus.status === "error"
                                    ? `Error: ${serverStatus.error}`
                                    : "Not connected" })] }), error && _jsx("div", { className: "error-message", children: error }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "AI Provider" }), _jsx("select", { value: provider, onChange: (e) => setProvider(e.target.value), children: PROVIDERS.map((p) => (_jsx("option", { value: p.id, children: p.label }, p.id))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "API Key" }), _jsx("input", { type: "password", value: apiKey, onChange: (e) => setApiKey(e.target.value), placeholder: `Enter your ${PROVIDERS.find((p) => p.id === provider)?.label || provider} API key` })] })] }));
}
//# sourceMappingURL=opencode-settings.js.map