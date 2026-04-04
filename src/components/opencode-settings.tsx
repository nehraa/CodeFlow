"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpencodeProvider, OpencodeServerInfo, OpencodeConfig, McpServerConfig as McpServer } from "@/lib/opencode/types";
import { PROVIDER_CONFIGS } from "@/lib/opencode/types";
import {
  checkServerStatus,
  startServer,
  stopServer,
  restartServer,
} from "@/lib/opencode/client";
import {
  loadConfig,
  saveConfig,
  validateConfig,
  detectProvider,
  buildOpencodeConfig,
} from "@/lib/opencode/config";
import { ApiKeyValidator } from "@/lib/opencode/api-key-validator";

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Track if provider was manually selected (vs auto-detected)
  const [isManuallySelected, setIsManuallySelected] = useState(false);
  
  // MCP server configuration
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpCommand, setNewMcpCommand] = useState("");
  const [newMcpArgs, setNewMcpArgs] = useState("");
  
  // Skills configuration
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  
  // Hooks configuration
  const [hooks, setHooks] = useState<string[]>([]);
  const [newHook, setNewHook] = useState("");
  
  // Agent selection
  const [selectedAgent, setSelectedAgent] = useState<"build" | "plan">("build");

  // Load saved config on mount - ONLY on initial load
  useEffect(() => {
    const saved = loadConfig();
    if (saved) {
      setProvider(saved.provider);
      setModel(saved.model || "");
      setBaseUrl(saved.baseUrl || "");
      setMcpServers(saved.mcpServers || []);
      setSkills(saved.skills || []);
      setHooks(saved.hooks || []);
      if (saved.apiKey) {
        setApiKey(saved.apiKey);
      }
      // Mark as manually selected since it was saved by user
      setIsManuallySelected(true);
    }
    
    // Check server status
    checkServerStatus()
      .then((info) => {
        setServerStatus(info);
        onStatusChange?.(info);
      })
      .catch(() => {
        setServerStatus({ status: "stopped" });
      });
  }, []); // Empty dependency: run only on mount

  // Auto-detect provider from API key - ONLY on initial load if no saved config
  useEffect(() => {
    // Skip auto-detection if user manually selected provider
    if (isManuallySelected) {
      return;
    }
    
    // Only auto-detect if apiKey exists and provider still at default
    if (apiKey && apiKey.length > 10 && provider === "anthropic") {
      const detected = detectProvider(apiKey);
      if (detected && detected !== provider) {
        setProvider(detected);
        setModel(PROVIDER_CONFIGS[detected].defaultModel);
      }
    }
  }, [apiKey]); // Only depend on apiKey, not provider

  // Set default model when provider changes
  useEffect(() => {
    if (!model) {
      setModel(PROVIDER_CONFIGS[provider].defaultModel);
    }
  }, [provider, model]);

  const handleStartServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = buildOpencodeConfig(provider, apiKey, {
        model: model || undefined,
        baseUrl: baseUrl || undefined,
        mcpServers,
        skills,
        hooks,
      });
      
      const validation = validateConfig(config);
      if (!validation.valid) {
        setError(validation.error || "Invalid configuration");
        setIsLoading(false);
        return;
      }
      
      // Save config before starting
      saveConfig(config);
      
      const info = await startServer({
        provider,
        apiKey,
        model: model || undefined,
        baseUrl: baseUrl || undefined,
      });
      
      setServerStatus(info);
      onStatusChange?.(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start server");
      setServerStatus({ status: "error", error: String(err) });
    } finally {
      setIsLoading(false);
    }
  }, [provider, apiKey, model, baseUrl, mcpServers, skills, hooks, onStatusChange]);

  const handleStopServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await stopServer();
      setServerStatus({ status: "stopped" });
      onStatusChange?.({ status: "stopped" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop server");
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  const handleRestartServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const info = await restartServer({
        provider,
        apiKey,
        model: model || undefined,
        baseUrl: baseUrl || undefined,
      });
      
      setServerStatus(info);
      onStatusChange?.(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart server");
    } finally {
      setIsLoading(false);
    }
  }, [provider, apiKey, model, baseUrl, onStatusChange]);

  const handleAddMcpServer = useCallback(() => {
    if (!newMcpName.trim() || !newMcpCommand.trim()) return;
    
    const server: McpServer = {
      name: newMcpName.trim(),
      command: newMcpCommand.trim(),
      args: newMcpArgs ? newMcpArgs.split(" ").filter(Boolean) : undefined,
    };
    
    setMcpServers((prev) => [...prev, server]);
    setNewMcpName("");
    setNewMcpCommand("");
    setNewMcpArgs("");
  }, [newMcpName, newMcpCommand, newMcpArgs]);

  const handleRemoveMcpServer = useCallback((index: number) => {
    setMcpServers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSkill = useCallback(() => {
    if (!newSkill.trim()) return;
    setSkills((prev) => [...prev, newSkill.trim()]);
    setNewSkill("");
  }, [newSkill]);

  const handleRemoveSkill = useCallback((index: number) => {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddHook = useCallback(() => {
    if (!newHook.trim()) return;
    setHooks((prev) => [...prev, newHook.trim()]);
    setNewHook("");
  }, [newHook]);

  const handleRemoveHook = useCallback((index: number) => {
    setHooks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveConfig = useCallback(() => {
    const config = buildOpencodeConfig(provider, apiKey, {
      model: model || undefined,
      baseUrl: baseUrl || undefined,
      mcpServers,
      skills,
      hooks,
    });
    saveConfig(config);
    setError(null);
  }, [provider, apiKey, model, baseUrl, mcpServers, skills, hooks]);

  const providerConfig = PROVIDER_CONFIGS[provider];

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

      {/* Server Status */}
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

      {/* Provider Selection */}
      <label className="field">
        <span>AI Provider</span>
        <select
          value={provider}
          onChange={(e) => {
            const newProvider = e.target.value as OpencodeProvider;
            setProvider(newProvider);
            setModel(PROVIDER_CONFIGS[newProvider].defaultModel);
            setIsManuallySelected(true); // Mark as user's explicit choice
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {/* API Key */}
      <label className="field">
        <span>API Key</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Enter your ${PROVIDERS.find((p) => p.id === provider)?.label || provider} API key`}
        />
        <small>
          {apiKey
            ? `✓ Key provided (${apiKey.slice(0, 8)}...)`
            : `Required for ${provider}`}
        </small>
      </label>

      {/* API Key Validation & Model Discovery */}
      <ApiKeyValidator
        provider={provider}
        apiKey={apiKey}
        selectedModel={model}
        onModelChange={setModel}
      />

      {/* Base URL (if required) */}
      {providerConfig.baseUrlRequired && (
        <label className="field">
          <span>Base URL</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-endpoint.com"
          />
        </label>
      )}

      {/* Agent Selection */}
      <fieldset className="field">
        <span>Default Agent</span>
        <div className="choice-row">
          <label>
            <input
              type="radio"
              name="agent"
              value="build"
              checked={selectedAgent === "build"}
              onChange={() => setSelectedAgent("build")}
            />
            Build (Full access)
          </label>
          <label>
            <input
              type="radio"
              name="agent"
              value="plan"
              checked={selectedAgent === "plan"}
              onChange={() => setSelectedAgent("plan")}
            />
            Plan (Read-only)
          </label>
        </div>
        <small>
          {selectedAgent === "build"
            ? "Build agent can edit files and run commands"
            : "Plan agent only analyzes code without making changes"}
        </small>
      </fieldset>

      {/* Server Controls */}
      <div className="button-row server-controls">
        {serverStatus.status === "stopped" || serverStatus.status === "error" ? (
          <button
            onClick={handleStartServer}
            disabled={isLoading || !apiKey}
            type="button"
            className="primary"
          >
            {isLoading ? "Starting..." : "Start OpenCode"}
          </button>
        ) : serverStatus.status === "running" ? (
          <>
            <button onClick={handleRestartServer} disabled={isLoading} type="button">
              {isLoading ? "Restarting..." : "Restart"}
            </button>
            <button onClick={handleStopServer} disabled={isLoading} type="button">
              Stop
            </button>
          </>
        ) : null}
        <button onClick={handleSaveConfig} type="button">
          Save Config
        </button>
      </div>

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        type="button"
        className="toggle-advanced"
      >
        {showAdvanced ? "▼ Hide Advanced" : "▶ Show Advanced"}
      </button>

      {showAdvanced && (
        <div className="advanced-settings">
          {/* MCP Servers */}
          <div className="subsection">
            <h4>MCP Servers</h4>
            <small>Configure Model Context Protocol servers for extended capabilities</small>
            
            {mcpServers.map((server, index) => (
              <div key={index} className="mcp-server-item">
                <span className="mcp-name">{server.name}</span>
                <code className="mcp-command">{server.command}</code>
                <button onClick={() => handleRemoveMcpServer(index)} type="button">
                  ×
                </button>
              </div>
            ))}
            
            <div className="add-mcp-form">
              <input
                type="text"
                value={newMcpName}
                onChange={(e) => setNewMcpName(e.target.value)}
                placeholder="Server name"
              />
              <input
                type="text"
                value={newMcpCommand}
                onChange={(e) => setNewMcpCommand(e.target.value)}
                placeholder="Command (e.g., npx server)"
              />
              <input
                type="text"
                value={newMcpArgs}
                onChange={(e) => setNewMcpArgs(e.target.value)}
                placeholder="Args (space-separated)"
              />
              <button
                onClick={handleAddMcpServer}
                disabled={!newMcpName.trim() || !newMcpCommand.trim()}
                type="button"
              >
                Add
              </button>
            </div>
          </div>

          {/* Skills */}
          <div className="subsection">
            <h4>Skills</h4>
            <small>Enable OpenCode skills for specialized capabilities</small>
            
            <div className="tags-list">
              {skills.map((skill, index) => (
                <span key={index} className="tag">
                  {skill}
                  <button onClick={() => handleRemoveSkill(index)} type="button">
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            <div className="add-tag-form">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Skill name"
              />
              <button onClick={handleAddSkill} disabled={!newSkill.trim()} type="button">
                Add Skill
              </button>
            </div>
          </div>

          {/* Hooks */}
          <div className="subsection">
            <h4>Hooks</h4>
            <small>Configure pre/post hooks for automated workflows</small>
            
            <div className="tags-list">
              {hooks.map((hook, index) => (
                <span key={index} className="tag">
                  {hook}
                  <button onClick={() => handleRemoveHook(index)} type="button">
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            <div className="add-tag-form">
              <input
                type="text"
                value={newHook}
                onChange={(e) => setNewHook(e.target.value)}
                placeholder="Hook path or name"
              />
              <button onClick={handleAddHook} disabled={!newHook.trim()} type="button">
                Add Hook
              </button>
            </div>
          </div>

          {/* Base URL Override */}
          {!providerConfig.baseUrlRequired && (
            <label className="field">
              <span>Base URL Override (optional)</span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Leave empty for default endpoint"
              />
            </label>
          )}
        </div>
      )}

      <style jsx>{`
        .opencode-settings {
          padding: 1rem;
        }
        .opencode-settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .opencode-settings-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0 0.5rem;
        }
        .server-status-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-stopped { background: #888; }
        .status-starting { background: #f59e0b; animation: pulse 1s infinite; }
        .status-running { background: #22c55e; }
        .status-error { background: #ef4444; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .status-text {
          font-size: 0.85rem;
        }
        .error-message {
          background: #fef2f2;
          color: #dc2626;
          padding: 0.5rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.85rem;
        }
        .server-controls {
          margin: 1rem 0;
        }
        .button-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .toggle-advanced {
          background: none;
          border: none;
          color: var(--text-secondary, #666);
          cursor: pointer;
          padding: 0.5rem 0;
          font-size: 0.85rem;
        }
        .advanced-settings {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color, #e5e5e5);
        }
        .subsection {
          margin-bottom: 1.5rem;
        }
        .subsection h4 {
          margin: 0 0 0.25rem;
          font-size: 0.95rem;
        }
        .subsection small {
          color: var(--text-secondary, #666);
          display: block;
          margin-bottom: 0.5rem;
        }
        .mcp-server-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 4px;
          margin-bottom: 0.5rem;
        }
        .mcp-name {
          font-weight: 500;
        }
        .mcp-command {
          font-size: 0.8rem;
          flex: 1;
        }
        .add-mcp-form {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .add-mcp-form input {
          flex: 1;
          min-width: 100px;
        }
        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: var(--accent-light, #e0f2fe);
          border-radius: 4px;
          font-size: 0.85rem;
        }
        .tag button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-size: 1rem;
          line-height: 1;
        }
        .add-tag-form {
          display: flex;
          gap: 0.5rem;
        }
        .add-tag-form input {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
