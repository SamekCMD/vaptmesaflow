# Termly Turnstile Essential Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Cloudflare Turnstile to load before optional cookie consent by classifying its script as essential in Termly.

**Architecture:** Add a narrow Termly custom blocking map in `index.html` before the resource blocker. Protect the load order and exact hostname classification with a Vitest regression test that reads the real HTML entry point.

**Tech Stack:** Vite, Vitest, HTML, Termly Auto Blocker, Cloudflare Turnstile

---

### Task 1: Exempt the Turnstile security script from optional consent

**Files:**
- Create: `src/test/termly-turnstile-config.test.ts`
- Modify: `index.html`

- [ ] **Step 1: Write the failing regression test**

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Termly Turnstile configuration", () => {
  it("classifies the Turnstile host as essential before loading Termly", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const html = readFileSync(`${root}index.html`, "utf8");
    const mapPosition = html.indexOf("TERMLY_CUSTOM_BLOCKING_MAP");
    const blockerPosition = html.indexOf("https://app.termly.io/resource-blocker/");

    expect(mapPosition).toBeGreaterThan(-1);
    expect(blockerPosition).toBeGreaterThan(mapPosition);
    expect(html).toContain('"challenges.cloudflare.com": "essential"');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/test/termly-turnstile-config.test.ts`

Expected: FAIL because `TERMLY_CUSTOM_BLOCKING_MAP` is absent from `index.html`.

- [ ] **Step 3: Add the minimal blocking map before Termly**

Insert before the existing Termly resource-blocker script in `index.html`:

```html
<script data-termly-config>
  window.TERMLY_CUSTOM_BLOCKING_MAP = {
    "challenges.cloudflare.com": "essential",
  };
</script>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/test/termly-turnstile-config.test.ts`

Expected: one test file and one test pass.

- [ ] **Step 5: Run complete verification**

Run: `npm test`

Expected: all test files pass.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 6: Commit and publish**

```bash
git add index.html src/test/termly-turnstile-config.test.ts docs/superpowers/plans/2026-08-31-termly-turnstile-essential.md
git commit -m "fix: allow Turnstile before cookie consent"
git push
```

- [ ] **Step 7: Validate the deployed preview**

Decline optional cookies, open `/login`, `/signup`, and `/forgot-password`, and
confirm that the Turnstile script has an executable `src`, is not marked
`data-autoblocked`, and creates its challenge iframe.

