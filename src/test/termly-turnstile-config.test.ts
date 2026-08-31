import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Termly Turnstile configuration", () => {
  it("classifies the Turnstile host as essential before loading Termly", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const mapPosition = html.indexOf("TERMLY_CUSTOM_BLOCKING_MAP");
    const blockerPosition = html.indexOf("https://app.termly.io/resource-blocker/");

    expect(mapPosition).toBeGreaterThan(-1);
    expect(blockerPosition).toBeGreaterThan(mapPosition);
    expect(html).toContain('"challenges.cloudflare.com": "essential"');
  });
});
