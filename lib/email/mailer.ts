import nodemailer from "nodemailer";
import { getSmtpConfig, type SmtpConfig } from "./config";

type MailerInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type MailerFactoryInput = {
  env?: Record<string, string | undefined>;
  transportFactory?: (config: SmtpConfig) => {
    sendMail: (payload: Record<string, unknown>) => Promise<unknown>;
  };
};

export function createMailer({
  env = process.env,
  transportFactory = (config) =>
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTls,
      auth: config.auth
    })
}: MailerFactoryInput = {}) {
  const config = getSmtpConfig(env);
  const transport = transportFactory(config);

  return {
    async send(input: MailerInput) {
      return transport.sendMail({
        from: `"${config.from.name}" <${config.from.email}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text
      });
    }
  };
}

export async function sendVerificationCodeEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  return createMailer().send(input);
}
