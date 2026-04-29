import { describe, expect, it } from "vitest";
import {
  KNOWN_RUNTIME_ENV_VARS,
  getKnownRuntimeEnvVars,
  isKnownRuntimeEnvKey
} from "@/lib/runtime/runtime-env-keys";

describe("runtime env keys", () => {
  it("includes the Gemini and MiniMax provider keys on the shared whitelist", () => {
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("GEMINI_API_KEY");
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("GOOGLE_API_KEY");
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("MINIMAX_API_KEY");
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("BRAVE_SEARCH_API_KEY");
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("TURNSTILE_SECRET_KEY");
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID");
  });

  it("includes the role-refresh schedule env key on the shared whitelist", () => {
    expect(KNOWN_RUNTIME_ENV_VARS).toContain("ROLE_RADAR_ROLE_REFRESH_SCHEDULE");
    expect(isKnownRuntimeEnvKey("ROLE_RADAR_ROLE_REFRESH_SCHEDULE")).toBe(true);
  });

  it("exposes the known runtime env keys as a copy", () => {
    const keys = getKnownRuntimeEnvVars();

    expect(keys).toEqual(KNOWN_RUNTIME_ENV_VARS);
    expect(keys).not.toBe(KNOWN_RUNTIME_ENV_VARS);
  });

  it("recognizes known runtime env keys", () => {
    expect(isKnownRuntimeEnvKey("GOOGLE_API_KEY")).toBe(true);
    expect(isKnownRuntimeEnvKey("NOT_A_REAL_KEY")).toBe(false);
  });
});
