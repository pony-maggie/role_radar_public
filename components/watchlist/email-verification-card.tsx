"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import React, { FormEvent, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
    __roleRadarTurnstileOnSuccess?: (token: string) => void;
    __roleRadarTurnstileOnExpired?: () => void;
    __roleRadarTurnstileOnError?: () => void;
  }
}

export function EmailVerificationCard({
  locale,
  turnstileSiteKey
}: {
  locale: "en" | "zh";
  turnstileSiteKey: string;
}) {
  const router = useRouter();
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [turnstileScriptLoaded, setTurnstileScriptLoaded] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [stage, setStage] = useState<"request" | "verify" | "done">("request");

  const title = locale === "zh" ? "使用邮箱验证码登录" : "Sign in with an email code";
  const helper =
    locale === "zh"
      ? "输入邮箱后获取验证码，验证后即可开始追踪岗位。"
      : "Request a code, verify it, and then start tracking roles.";
  const requestLabel = locale === "zh" ? "发送验证码" : "Send code";
  const verifyLabel = locale === "zh" ? "验证并继续" : "Verify and continue";
  const emailLabel = locale === "zh" ? "邮箱" : "Email";
  const codeLabel = locale === "zh" ? "验证码" : "Verification code";
  const humanCheckLabel = locale === "zh" ? "人机验证" : "Human verification";

  useEffect(() => {
    if (!turnstileEnabled) {
      return;
    }

    window.__roleRadarTurnstileOnSuccess = (token: string) => {
      setTurnstileToken(token);
    };
    window.__roleRadarTurnstileOnExpired = () => {
      setTurnstileToken(null);
    };
    window.__roleRadarTurnstileOnError = () => {
      setTurnstileToken(null);
      setMessage(
        locale === "zh"
          ? "人机验证加载失败，请检查当前域名是否已加入 Cloudflare Turnstile 的允许列表。"
          : "Human verification failed to load. Check that this domain is allowed in Cloudflare Turnstile."
      );
    };

    return () => {
      delete window.__roleRadarTurnstileOnSuccess;
      delete window.__roleRadarTurnstileOnExpired;
      delete window.__roleRadarTurnstileOnError;
    };
  }, [locale, turnstileEnabled]);

  useEffect(() => {
    if (
      !turnstileEnabled ||
      !turnstileScriptLoaded ||
      !turnstileContainerRef.current ||
      !window.turnstile ||
      turnstileWidgetIdRef.current
    ) {
      return;
    }

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => window.__roleRadarTurnstileOnSuccess?.(token),
      "expired-callback": () => window.__roleRadarTurnstileOnExpired?.(),
      "error-callback": () => window.__roleRadarTurnstileOnError?.()
    });
  }, [turnstileEnabled, turnstileScriptLoaded, turnstileSiteKey]);

  function resetTurnstile() {
    setTurnstileToken(null);
    if (turnstileEnabled) {
      window.turnstile?.reset(turnstileWidgetIdRef.current ?? undefined);
    }
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, turnstileToken })
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      devPreviewCode?: string | null;
      error?: string;
    };

    if (!response.ok) {
      resetTurnstile();
      setMessage(payload.error ?? "Unable to request code");
      return;
    }

    setStage("verify");
    setDevPreviewCode(payload.devPreviewCode ?? null);
    setMessage(
      locale === "zh"
        ? "验证码已发送。开发环境下会直接显示预览码。"
        : "Code sent. In development the preview code is shown here."
    );
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to verify code");
      return;
    }

    setStage("done");
    setMessage(locale === "zh" ? "登录成功，正在加载追踪列表。" : "Signed in. Loading watchlist.");
    router.refresh();
  }

  return (
    <section className="research-card section-stack auth-card">
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileScriptLoaded(true)}
        />
      ) : null}
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="section-note">{locale === "zh" ? "先登录，再追踪" : "Log in first"}</span>
      </div>
      <p className="page-copy">{helper}</p>
      <form className="watchlist-form auth-form" onSubmit={stage === "request" ? handleRequestCode : handleVerifyCode}>
        <label className="watchlist-field">
          <span className="watchlist-label">{emailLabel}</span>
          <input
            aria-label={emailLabel}
            className="watchlist-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {stage === "request" && turnstileEnabled ? (
          <div className="watchlist-field">
            <span className="watchlist-label">{humanCheckLabel}</span>
            <div ref={turnstileContainerRef} />
          </div>
        ) : null}
        {stage !== "request" ? (
          <label className="watchlist-field">
            <span className="watchlist-label">{codeLabel}</span>
            <input
              aria-label={codeLabel}
              className="watchlist-input"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
        ) : null}
        <button className="watchlist-button" type="submit">
          {stage === "request" ? requestLabel : verifyLabel}
        </button>
      </form>
      {devPreviewCode ? (
        <p className="flash-message dev-code-card">
          {locale === "zh" ? "开发预览码：" : "Dev preview code: "}
          <strong>{devPreviewCode}</strong>
        </p>
      ) : null}
      {message ? <p className="flash-message">{message}</p> : null}
    </section>
  );
}
