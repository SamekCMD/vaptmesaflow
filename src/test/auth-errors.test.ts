import { describe, expect, it } from "vitest";

import {
  AUTH_CAPTCHA_MESSAGE,
  AUTH_RATE_LIMIT_MESSAGE,
  mapAuthError,
} from "@/features/auth/auth-errors";

describe("auth error mapping", () => {
  it.each(["over_request_rate_limit", "over_email_send_rate_limit"])(
    "maps %s to retry guidance",
    (code) => {
      expect(mapAuthError(Object.assign(new Error("failed"), { code }), "fallback")).toBe(
        AUTH_RATE_LIMIT_MESSAGE,
      );
    },
  );

  it("maps CAPTCHA failures without exposing provider details", () => {
    expect(mapAuthError(new Error("captcha verification failed"), "fallback")).toBe(
      AUTH_CAPTCHA_MESSAGE,
    );
  });
});
