import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const bannedWriterPattern = /supabase|service_role|\/rest\/v1/i;

function jsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(path)
      : entry.isFile() && entry.name.endsWith(".json")
        ? [path]
        : [];
  });
}

describe("n8n operational persistence boundary", () => {
  it("keeps Stripe and ingest exports free of Supabase/PostgREST writers", () => {
    const operationalDirectories = [
      join(repositoryRoot, "docs", "integrations", "n8n", "stripe"),
      join(repositoryRoot, "docs", "integrations", "n8n", "ingest"),
    ];
    const offenders = operationalDirectories
      .flatMap(jsonFiles)
      .filter((path) => bannedWriterPattern.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });

  it("has no browser n8n client and uses the Vapt API directly for push", () => {
    expect(existsSync(join(repositoryRoot, "src", "lib", "n8n-client.ts"))).toBe(false);
    const client = readFileSync(join(repositoryRoot, "src", "lib", "push-notifications.ts"), "utf8");
    expect(client).not.toMatch(/n8nClient|N8nClient|n8n-client/);
    expect(client).toContain("vaptApiRequest");
    expect(client).toContain("ingest/push-subscription");
  });
});
