export class TurnstileVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TurnstileVerificationError";
  }
}

type TurnstileEnv = NodeJS.ProcessEnv & {
  TURNSTILE_SECRET_KEY?: string;
};

type FetchLike = typeof fetch;

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken({
  token,
  remoteIp,
  env = process.env,
  fetchImpl = fetch
}: {
  token: string | null | undefined;
  remoteIp: string | null;
  env?: TurnstileEnv;
  fetchImpl?: FetchLike;
}) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { enabled: false, success: true as const };
  }

  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    throw new TurnstileVerificationError("Complete the human verification challenge.");
  }

  const body = new URLSearchParams({
    secret,
    response: normalizedToken
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new TurnstileVerificationError("Unable to verify the human verification challenge.");
  }

  const payload = (await response.json()) as TurnstileResponse;
  if (!payload.success) {
    throw new TurnstileVerificationError("Complete the human verification challenge.");
  }

  return { enabled: true, success: true as const };
}
