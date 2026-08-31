import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const templatePath = path.resolve(
  process.cwd(),
  "public/auth-email-confirmation.html",
);

describe("Auth confirmation email template", () => {
  const template = readFileSync(templatePath, "utf8");

  it("keeps the GoTrue confirmation variables intact", () => {
    expect(template).toContain("{{ .Token }}");
    expect(template).toContain('href="{{ .ConfirmationURL }}"');
    expect(template.match(/{{ \.ConfirmationURL }}/g)).toHaveLength(2);
  });

  it("contains the Vapt confirmation copy and email-safe structure", () => {
    expect(template).toContain("Confirme seu email");
    expect(template).toContain("Confirmar meu email");
    expect(template).toContain('role="presentation"');
    expect(template).not.toMatch(/<script\b/i);
    expect(template).not.toMatch(/<img\b/i);
  });

  it("never embeds a local or preview host", () => {
    expect(template).not.toMatch(/localhost|127\.0\.0\.1/i);
    expect(template).not.toMatch(/vercel\.app/i);
  });
});
