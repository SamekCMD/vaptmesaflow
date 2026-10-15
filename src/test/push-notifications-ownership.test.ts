import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dismissPushBanner,
  isAlreadySubscribed,
  isPushDismissed,
  reconcilePushSubscriptionOwner,
} from "@/lib/push-notifications";

describe("push subscription ownership", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("scopes banner dismissal to the current restaurant", () => {
    dismissPushBanner("restaurant-1");

    expect(isPushDismissed("restaurant-1")).toBe(true);
    expect(isPushDismissed("restaurant-2")).toBe(false);
  });

  it("proactively detaches the old browser subscription when the restaurant changes", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    localStorage.setItem("push_subscribed:restaurant-1", "true");
    localStorage.setItem("push_banner_dismissed:restaurant-1", "true");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([
          {
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue({ unsubscribe }),
            },
          },
        ]),
      },
    });

    await reconcilePushSubscriptionOwner("restaurant-2");

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(isAlreadySubscribed("restaurant-1")).toBe(false);
    expect(isAlreadySubscribed("restaurant-2")).toBe(false);
    expect(isPushDismissed("restaurant-2")).toBe(false);
  });

  it("disables the service worker when push unsubscribe resolves false", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    localStorage.setItem("push_subscribed:restaurant-1", "true");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([
          {
            unregister,
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue({
                unsubscribe: vi.fn().mockResolvedValue(false),
              }),
            },
          },
        ]),
      },
    });

    await expect(reconcilePushSubscriptionOwner("restaurant-2")).resolves.toBe(true);
    expect(unregister).toHaveBeenCalledOnce();
    expect(isAlreadySubscribed("restaurant-1")).toBe(false);
  });

  it("retains ownership markers when unsubscribe and worker fallback both fail", async () => {
    const unregister = vi.fn().mockResolvedValue(false);
    localStorage.setItem("push_subscribed:restaurant-1", "true");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([
          {
            unregister,
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue({
                unsubscribe: vi.fn().mockRejectedValue(new Error("push service unavailable")),
              }),
            },
          },
        ]),
      },
    });

    await expect(reconcilePushSubscriptionOwner("restaurant-2")).resolves.toBe(false);
    expect(unregister).toHaveBeenCalledOnce();
    expect(isAlreadySubscribed("restaurant-1")).toBe(true);
  });

  it("does not reuse the legacy global marker for another restaurant", () => {
    localStorage.setItem("push_subscribed", "true");

    expect(isAlreadySubscribed("restaurant-2")).toBe(false);
  });

  it("recognizes only the marker scoped to the current restaurant", () => {
    localStorage.setItem("push_subscribed:restaurant-1", "true");

    expect(isAlreadySubscribed("restaurant-1")).toBe(true);
    expect(isAlreadySubscribed("restaurant-2")).toBe(false);
  });
});
