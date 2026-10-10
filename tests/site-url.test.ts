import { afterEach, describe, expect, it, vi } from "vitest";
import { publicSiteUrl } from "../src/lib/seo/site-url";

describe("public site URL gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps local development unindexed without an approved URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(publicSiteUrl()).toBeNull();
  });

  it("rejects HTTP and localhost placeholders", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3100");
    expect(publicSiteUrl()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://localhost");
    expect(publicSiteUrl()).toBeNull();
  });

  it("accepts a clean public HTTPS origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://merchant.example");
    expect(publicSiteUrl()?.href).toBe("https://merchant.example/");
  });

  it("rejects a path or query so canonicals cannot inherit stray segments", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://merchant.example/private?draft=1");
    expect(publicSiteUrl()).toBeNull();
  });
});
