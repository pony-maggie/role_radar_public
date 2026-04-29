import { describe, expect, it } from "vitest";
import {
  buildBaseMetadata,
  buildCanonicalUrl,
  buildLocaleAlternates,
  buildNoIndexMetadata,
  buildPublicPageMetadata,
  buildRobotsDirectives
} from "@/lib/seo/metadata";

describe("seo metadata helpers", () => {
  it("builds canonical urls for locale routes", () => {
    expect(buildCanonicalUrl("/zh/roles/actors")).toBe("http://localhost:3000/zh/roles/actors");
  });

  it("builds alternate-language entries for locale twins", () => {
    expect(buildLocaleAlternates("/en/roles/actors")).toMatchObject({
      en: "http://localhost:3000/en/roles/actors",
      zh: "http://localhost:3000/zh/roles/actors",
      "x-default": "http://localhost:3000/en/roles/actors"
    });
  });

  it("marks operator pages as noindex", () => {
    expect(buildRobotsDirectives({ index: false })).toMatchObject({
      index: false,
      follow: false
    });
  });

  it("builds shared base metadata from the configured site url", () => {
    expect(buildBaseMetadata()).toMatchObject({
      applicationName: "Role Radar",
      metadataBase: new URL("http://localhost:3000")
    });
  });

  it("builds public page metadata with canonical and alternate urls", () => {
    expect(
      buildPublicPageMetadata({
        locale: "en",
        pathname: "/en/methodology",
        title: "Methodology | Role Radar",
        description: "Learn how Role Radar combines role structure and bounded external signals."
      })
    ).toMatchObject({
      title: "Methodology | Role Radar",
      description: "Learn how Role Radar combines role structure and bounded external signals.",
      robots: {
        index: true,
        follow: true
      },
      alternates: {
        canonical: "http://localhost:3000/en/methodology",
        languages: {
          en: "http://localhost:3000/en/methodology",
          zh: "http://localhost:3000/zh/methodology",
          "x-default": "http://localhost:3000/en/methodology"
        }
      }
    });
  });

  it("builds noindex metadata for private and operator pages", () => {
    expect(buildNoIndexMetadata()).toMatchObject({
      robots: {
        index: false,
        follow: false
      }
    });
  });
});
