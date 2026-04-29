import fs from "node:fs";
import path from "node:path";

type LoggerEnv = Record<string, string | undefined>;
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getLogPath(env: LoggerEnv) {
  return env.ROLE_RADAR_LOG_PATH?.trim() || path.join(process.cwd(), "tmp", "logs", "role-radar.log");
}

function getLogLevel(env: LoggerEnv): LogLevel {
  const value = (env.ROLE_RADAR_LOG_LEVEL?.trim().toLowerCase() || "info") as LogLevel;
  return value in LEVEL_ORDER ? value : "info";
}

export function createLogger({ env = process.env }: { env?: LoggerEnv } = {}) {
  const filePath = getLogPath(env);
  const minLevel = getLogLevel(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${context ? ` ${JSON.stringify(context)}` : ""}\n`;

    try {
      fs.appendFileSync(filePath, line, "utf8");
    } catch {
      // Keep stdout/stderr logging alive even if file append fails.
    }

    if (level === "error") {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }

  return {
    debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
    info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
  };
}

export const logger = createLogger();
