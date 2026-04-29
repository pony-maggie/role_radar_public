import React from "react";
import Script from "next/script";

export function GoogleAnalyticsTag() {
  const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();

  if (process.env.NODE_ENV !== "production" || !googleAnalyticsId) {
    return null;
  }

  return (
    <>
      {/* This component is mounted only from app/layout.tsx so the root-layout rule still applies. */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
        strategy="beforeInteractive"
      />
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="google-analytics" strategy="beforeInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', '${googleAnalyticsId}');`}
      </Script>
    </>
  );
}
