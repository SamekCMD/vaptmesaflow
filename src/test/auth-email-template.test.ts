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

describe("Auth recovery email template", () => {
  const readRecovery = () => readFileSync(
    path.resolve(process.cwd(), "public/auth-email-recovery.html"), "utf8",
  );

  it("offers only the recovery link, without an unusable OTP", () => {
    const template = readRecovery();
    expect(template).toContain('href="{{ .ConfirmationURL }}"');
    expect(template.match(/{{ \.ConfirmationURL }}/g)).toHaveLength(2);
    expect(template).not.toMatch(/{{\s*\.(Token|TokenHash)\s*}}/);
    expect(template).not.toMatch(/c[oó]digo|OTP/i);
  });

  it("uses Vapt recovery copy and email-safe markup", () => {
    const template = readRecovery();
    expect(template).toContain("Redefinir minha senha");
    expect(template).toContain("Vapt");
    expect(template).toContain('role="presentation"');
    expect(template).not.toMatch(/<script\b|<form\b|<img\b/i);
    expect(template).not.toMatch(/localhost|127\.0\.0\.1|vercel\.app/i);
  });
});
