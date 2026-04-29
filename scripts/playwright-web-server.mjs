import { execFileSync, spawn } from "node:child_process";

const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const args = ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", PLAYWRIGHT_PORT];
const playwrightEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  REVIEW_QUEUE_TOKEN: process.env.REVIEW_QUEUE_TOKEN ?? "playwright-review-token",
  SMTP_HOST: "",
  SMTP_PORT: "",
  SMTP_USERNAME: "",
  SMTP_PASSWORD: "",
  SMTP_FROM_EMAIL: "",
  SMTP_FROM_NAME: "",
  TLS_MODE: "",
  TURNSTILE_SECRET_KEY: "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: ""
};

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: playwrightEnv
});

execFileSync("npm", ["run", "db:seed"], {
  stdio: "inherit",
  env: playwrightEnv
});

const child = spawn("npm", args, {
  stdio: "inherit",
  env: playwrightEnv
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
