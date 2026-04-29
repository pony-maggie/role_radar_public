import { describe, expect, it, vi } from "vitest";
import { getSmtpConfig, isSmtpConfigured } from "@/lib/email/config";
import { createMailer } from "@/lib/email/mailer";

describe("SMTP config", () => {
  it("detects when SMTP is fully configured", () => {
    expect(
      isSmtpConfigured({
        SMTP_HOST: "smtp.qq.com",
        SMTP_PORT: "465",
        SMTP_USERNAME: "mailer@example.com",
        SMTP_PASSWORD: "secret",
        SMTP_FROM_EMAIL: "mailer@example.com",
        SMTP_FROM_NAME: "Role Radar",
        TLS_MODE: "ssl"
      })
    ).toBe(true);
  });

  it("parses implicit TLS SMTP settings", () => {
    expect(
      getSmtpConfig({
        SMTP_HOST: "smtp.qq.com",
        SMTP_PORT: "465",
        SMTP_USERNAME: "mailer@example.com",
        SMTP_PASSWORD: "secret",
        SMTP_FROM_EMAIL: "mailer@example.com",
        SMTP_FROM_NAME: "Role Radar",
        TLS_MODE: "ssl"
      })
    ).toMatchObject({
      host: "smtp.qq.com",
      port: 465,
      secure: true,
      auth: {
        user: "mailer@example.com",
        pass: "secret"
      },
      from: {
        email: "mailer@example.com",
        name: "Role Radar"
      }
    });
  });

  it("writes messages through the configured transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "mail-123" });
    const mailer = createMailer({
      env: {
        SMTP_HOST: "smtp.qq.com",
        SMTP_PORT: "465",
        SMTP_USERNAME: "mailer@example.com",
        SMTP_PASSWORD: "secret",
        SMTP_FROM_EMAIL: "mailer@example.com",
        SMTP_FROM_NAME: "Role Radar",
        TLS_MODE: "ssl"
      },
      transportFactory: () => ({ sendMail }) as never
    });

    await mailer.send({
      to: "user@example.com",
      subject: "Role Radar code",
      html: "<p>123456</p>",
      text: "123456"
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Role Radar code"
      })
    );
  });
});
