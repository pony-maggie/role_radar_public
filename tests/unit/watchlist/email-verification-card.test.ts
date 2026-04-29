import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailVerificationCard } from "@/components/watchlist/email-verification-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

vi.mock("next/script", () => ({
  default: () => null
}));

describe("EmailVerificationCard", () => {
  it("shows the human verification field when a turnstile site key is provided at runtime", () => {
    render(React.createElement(EmailVerificationCard, { locale: "en", turnstileSiteKey: "site-key" }));

    expect(screen.getByText("Human verification")).not.toBeNull();
  });

  it("hides the human verification field when no turnstile site key is provided", () => {
    render(React.createElement(EmailVerificationCard, { locale: "en", turnstileSiteKey: "" }));

    expect(screen.queryByText("Human verification")).toBeNull();
  });
});
