import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { GoogleAnalyticsTag } from "@/components/shared/google-analytics-tag";

vi.mock("next/script", () => ({
  default: ({
    children,
    id,
    src,
    strategy
  }: {
    children?: React.ReactNode;
    id?: string;
    src?: string;
    strategy?: string;
  }) =>
    React.createElement(
      "script",
      {
        "data-script-id": id,
        "data-strategy": strategy,
        src
      },
      children
    )
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalGoogleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = originalGoogleAnalyticsId;
  cleanup();
});

describe("GoogleAnalyticsTag", () => {
  it("renders the configured Google tag only in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";

    const { container } = render(React.createElement(GoogleAnalyticsTag));
    const scripts = Array.from(container.querySelectorAll("script"));
    const loaderScript = container.querySelector(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
    );
    const configScript = container.querySelector('script[data-script-id="google-analytics"]');

    expect(scripts).toHaveLength(2);
    expect(loaderScript?.getAttribute("data-strategy")).toBe("beforeInteractive");
    expect(configScript?.textContent).toContain("gtag('config', 'G-TEST123');");
  });

  it("does not render the Google tag outside production", () => {
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";

    const { container } = render(React.createElement(GoogleAnalyticsTag));

    expect(container.querySelectorAll("script")).toHaveLength(0);
  });

  it("does not render the Google tag when the measurement id is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

    const { container } = render(React.createElement(GoogleAnalyticsTag));

    expect(container.querySelectorAll("script")).toHaveLength(0);
  });
});
