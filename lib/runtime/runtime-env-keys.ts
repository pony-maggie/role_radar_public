export const KNOWN_RUNTIME_ENV_VARS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_ENABLED",
  "MINIMAX_API_KEY",
  "MINIMAX_MODEL",
  "MINIMAX_ENABLED",
  "BRAVE_SEARCH_API_KEY",
  "ROLE_RADAR_ROLE_REFRESH_SCHEDULE",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "TLS_MODE",
  "ROLE_RADAR_LOG_PATH",
  "ROLE_RADAR_LOG_LEVEL"
] as const;

export type RuntimeEnvKey = (typeof KNOWN_RUNTIME_ENV_VARS)[number];

export function getKnownRuntimeEnvVars(): RuntimeEnvKey[] {
  return [...KNOWN_RUNTIME_ENV_VARS];
}

export function isKnownRuntimeEnvKey(value: string): value is RuntimeEnvKey {
  return (KNOWN_RUNTIME_ENV_VARS as readonly string[]).includes(value);
}
