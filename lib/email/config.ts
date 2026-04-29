type MailEnv = Record<string, string | undefined>;

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    email: string;
    name: string;
  };
};

function read(value: string | undefined) {
  return value?.trim() || "";
}

export function isSmtpConfigured(env: MailEnv = process.env) {
  return [
    read(env.SMTP_HOST),
    read(env.SMTP_PORT),
    read(env.SMTP_USERNAME),
    read(env.SMTP_PASSWORD),
    read(env.SMTP_FROM_EMAIL),
    read(env.SMTP_FROM_NAME),
    read(env.TLS_MODE)
  ].every(Boolean);
}

export function getSmtpConfig(env: MailEnv = process.env): SmtpConfig {
  if (!isSmtpConfigured(env)) {
    throw new Error("SMTP is not fully configured");
  }

  const tlsMode = read(env.TLS_MODE).toLowerCase();
  const secure = tlsMode === "ssl";

  return {
    host: read(env.SMTP_HOST),
    port: Number.parseInt(read(env.SMTP_PORT), 10),
    secure,
    requireTls: tlsMode === "starttls",
    auth: {
      user: read(env.SMTP_USERNAME),
      pass: read(env.SMTP_PASSWORD)
    },
    from: {
      email: read(env.SMTP_FROM_EMAIL),
      name: read(env.SMTP_FROM_NAME)
    }
  };
}
