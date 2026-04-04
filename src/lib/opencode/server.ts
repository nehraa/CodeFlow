/**
 * OpenCode server lifecycle management
 * Handles starting, stopping, and monitoring OpenCode server
 */

import { spawn } from "cross-spawn";
import type { ChildProcess } from "child_process";
import type { OpencodeConfig, OpencodeServerInfo, OpencodeServerStatus } from "./types";
import { configToEnv } from "./config";

const DEFAULT_PORT = 4096;
const DEFAULT_HOSTNAME = "127.0.0.1";
const STARTUP_TIMEOUT = 30000; // Increased from 10s to 30s
const HEALTH_CHECK_INTERVAL = 5000;

class OpencodeServer {
  private process: ChildProcess | null = null;
  private status: OpencodeServerStatus = "stopped";
  private url: string | null = null;
  private error: string | null = null;
  private port: number = DEFAULT_PORT;
  private hostname: string = DEFAULT_HOSTNAME;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(info: OpencodeServerInfo) => void> = new Set();

  /**
   * Start OpenCode server with the given configuration
   */
  async start(config: OpencodeConfig): Promise<OpencodeServerInfo> {
    if (this.status === "running") {
      return this.getInfo();
    }

    if (this.status === "starting") {
      throw new Error("Server is already starting");
    }

    this.setStatus("starting");

    try {
      const env = {
        ...process.env,
        ...configToEnv(config),
        OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      };

      const args = [
        "serve",
        `--hostname=${this.hostname}`,
        `--port=${this.port}`,
      ];

      if (config.logLevel) {
        args.push(`--log-level=${config.logLevel}`);
      }

      console.log("[OpenCode] Starting server with args:", args);
      console.log("[OpenCode] Provider:", config.provider);
      console.log("[OpenCode] API Key set:", !!config.apiKey);

      this.process = spawn("opencode", args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const serverUrl = await this.waitForServerStart();
      this.url = serverUrl;
      this.setStatus("running");
      this.startHealthChecks();

      this.process.on("exit", (code: number | null) => {
        this.handleExit(code);
      });

      this.process.on("error", (err: Error) => {
        this.handleError(err);
      });

      return this.getInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[OpenCode] Startup failed:", errorMsg);
      this.handleError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Stop the OpenCode server
   */
  async stop(): Promise<void> {
    this.stopHealthChecks();

    if (this.process) {
      this.process.kill("SIGTERM");
      
      // Force kill after 5 seconds if it doesn't stop
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGKILL");
          }
          resolve(undefined);
        }, 5000);

        this.process?.on("exit", () => {
          clearTimeout(timeout);
          resolve(undefined);
        });
      });

      this.process = null;
    }

    this.url = null;
    this.error = null;
    this.setStatus("stopped");
  }

  /**
   * Restart the server with new configuration
   */
  async restart(config: OpencodeConfig): Promise<OpencodeServerInfo> {
    await this.stop();
    return this.start(config);
  }

  /**
   * Get current server info
   */
  getInfo(): OpencodeServerInfo {
    return {
      status: this.status,
      url: this.url ?? undefined,
      error: this.error ?? undefined,
      pid: this.process?.pid,
    };
  }

  /**
   * Subscribe to server status changes
   */
  subscribe(listener: (info: OpencodeServerInfo) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current status
    listener(this.getInfo());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Wait for server to start and return URL
   */
  private async waitForServerStart(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Try health check as fallback
        const fallbackUrl = `http://${this.hostname}:${this.port}`;
        this.checkServerHealth(fallbackUrl)
          .then(() => {
            resolve(fallbackUrl);
          })
          .catch(() => {
            reject(new Error(`Server failed to start within ${STARTUP_TIMEOUT}ms`));
          });
      }, STARTUP_TIMEOUT);

      let output = "";
      const checkOutput = (data: Buffer) => {
        output += data.toString();
        
        // Log output for debugging
        console.log("[OpenCode Server]", data.toString().trim());
        
        const lines = output.split("\n");
        
        for (const line of lines) {
          // Match various server startup messages
          if (line.includes("listening") || line.includes("server running") || line.includes("Listening")) {
            // Try to extract URL from common patterns
            let url = null;
            
            // Pattern: "listening on http://..."
            const match1 = line.match(/(?:listening|running)\s+(?:on\s+)?(https?:\/\/[^\s]+)/i);
            if (match1) {
              url = match1[1];
            }
            
            // Pattern: "http://..." anywhere in the line
            if (!url) {
              const match2 = line.match(/(https?:\/\/[^\s]+)/);
              if (match2) {
                url = match2[1];
              }
            }
            
            // If we found a URL or just got the listening message, assume server is ready
            if (url || line.includes("listening")) {
              clearTimeout(timeout);
              resolve(url || `http://${this.hostname}:${this.port}`);
              return;
            }
          }
        }
      };

      this.process?.stdout?.on("data", checkOutput);
      this.process?.stderr?.on("data", checkOutput);
    });
  }

  /**
   * Check if server is healthy via HTTP
   */
  private async checkServerHealth(url: string): Promise<void> {
    const maxAttempts = 10;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        try {
          const response = await fetch(`${url}/health`, {
            method: "GET",
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok || response.status === 404) {
            return;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    throw lastError || new Error("Server health check failed");
  }

  /**
   * Perform health check on the server
   */
  private async healthCheck(): Promise<boolean> {
    if (!this.url) return false;

    try {
      const response = await fetch(`${this.url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.stopHealthChecks();
    
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.healthCheck();
      
      if (!healthy && this.status === "running") {
        this.setStatus("error", "Server health check failed");
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Handle server exit
   */
  private handleExit(code: number | null): void {
    this.process = null;
    this.url = null;
    
    if (code !== 0 && code !== null) {
      this.setStatus("error", `Server exited with code ${code}`);
    } else {
      this.setStatus("stopped");
    }
  }

  /**
   * Handle server error
   */
  private handleError(err: Error): void {
    this.process = null;
    this.url = null;
    this.setStatus("error", err.message);
  }

  /**
   * Update status and notify listeners
   */
  private setStatus(status: OpencodeServerStatus, error?: string): void {
    this.status = status;
    this.error = error ?? null;
    
    const info = this.getInfo();
    this.listeners.forEach((listener) => listener(info));
  }

  /**
   * Set custom port (must be called before start)
   */
  setPort(port: number): void {
    if (this.status !== "stopped") {
      throw new Error("Cannot change port while server is running");
    }
    this.port = port;
  }

  /**
   * Set custom hostname (must be called before start)
   */
  setHostname(hostname: string): void {
    if (this.status !== "stopped") {
      throw new Error("Cannot change hostname while server is running");
    }
    this.hostname = hostname;
  }
}

// Singleton instance
let serverInstance: OpencodeServer | null = null;

/**
 * Get the singleton OpenCode server instance
 */
export function getOpencodeServer(): OpencodeServer {
  if (!serverInstance) {
    serverInstance = new OpencodeServer();
  }
  return serverInstance;
}

/**
 * Helper: Start OpenCode server
 */
export async function startOpencodeServer(config: OpencodeConfig): Promise<OpencodeServerInfo> {
  const server = getOpencodeServer();
  return server.start(config);
}

/**
 * Helper: Stop OpenCode server
 */
export async function stopOpencodeServer(): Promise<void> {
  const server = getOpencodeServer();
  return server.stop();
}

/**
 * Helper: Restart OpenCode server
 */
export async function restartOpencodeServer(config: OpencodeConfig): Promise<OpencodeServerInfo> {
  const server = getOpencodeServer();
  return server.restart(config);
}

/**
 * Helper: Get server info
 */
export function getOpencodeServerInfo(): OpencodeServerInfo {
  const server = getOpencodeServer();
  return server.getInfo();
}

/**
 * Helper: Subscribe to server status changes
 */
export function subscribeToServerStatus(listener: (info: OpencodeServerInfo) => void): () => void {
  const server = getOpencodeServer();
  return server.subscribe(listener);
}
