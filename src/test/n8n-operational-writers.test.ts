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

  it("keeps the browser n8n client independent from Supabase auth", () => {
    const client = readFileSync(join(repositoryRoot, "src", "lib", "n8n-client.ts"), "utf8");
    expect(client).not.toMatch(bannedWriterPattern);
    expect(client).not.toContain("getAccessToken");
  });
});
