import { GoogleAnalyticsTag } from "@/components/shared/google-analytics-tag";
import { buildBaseMetadata } from "@/lib/seo/metadata";
import type { ReactNode } from "react";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

export const metadata = buildBaseMetadata();

const bodySans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body"
});

const bodyMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="und">
      <body className={`${bodySans.variable} ${bodyMono.variable}`}>
        <GoogleAnalyticsTag />
        {children}
      </body>
    </html>
  );
}
