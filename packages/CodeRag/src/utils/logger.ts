import type { Logger } from "../types.js";

const log = (level: string, message: string, context?: Record<string, unknown>) => {
  const payload = {
    level,
    message,
    ...context
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
};

export const createConsoleLogger = (): Logger => ({
  debug: (message, context) => log("debug", message, context),
  info: (message, context) => log("info", message, context),
  warn: (message, context) => log("warn", message, context),
  error: (message, context) => log("error", message, context)
});
