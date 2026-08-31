import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TurnstileWidget } from "@/features/auth/TurnstileWidget";

vi.mock("@/lib/env", () => ({
  ENV: { turnstileSiteKey: "turnstile-site-key" },
}));

describe("TurnstileWidget", () => {
  const renderWidget = vi.fn(() => "widget-1");
  const removeWidget = vi.fn();

  beforeEach(() => {
    renderWidget.mockClear();
    removeWidget.mockClear();
    window.turnstile = {
      render: renderWidget,
      remove: removeWidget,
    };
  });

  it("handles success and expiry and recreates the challenge on reset", async () => {
    const onToken = vi.fn();
    const { rerender, unmount } = render(
      <TurnstileWidget action="login" onToken={onToken} resetKey={0} />,
    );

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    const options = renderWidget.mock.calls[0][1];

    act(() => options.callback("captcha-token"));
    expect(onToken).toHaveBeenLastCalledWith("captcha-token");

    act(() => options["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);

    rerender(<TurnstileWidget action="login" onToken={onToken} resetKey={1} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-1");

    unmount();
    expect(removeWidget).toHaveBeenCalledTimes(2);
  });
});
