import { ENV } from "@/lib/env";
import { vaptApiRequest } from "@/lib/vapt-api-client";

const VAPID_PUBLIC_KEY = ENV.vapidPublicKey;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function isLocalDevEnvironment(): boolean {
  return import.meta.env.DEV || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY);
}

function pushDismissalKey(restaurantId: string): string {
  return `push_banner_dismissed:${restaurantId}`;
}

export function isPushDismissed(restaurantId: string): boolean {
  return localStorage.getItem(pushDismissalKey(restaurantId)) === "true";
}

export function dismissPushBanner(restaurantId: string): void {
  localStorage.setItem(pushDismissalKey(restaurantId), "true");
}

function pushSubscriptionKey(restaurantId: string): string {
  return `push_subscribed:${restaurantId}`;
}

export function isAlreadySubscribed(restaurantId: string): boolean {
  return localStorage.getItem(pushSubscriptionKey(restaurantId)) === "true";
}

function clearPushSubscriptionMarkers(): void {
  localStorage.removeItem("push_subscribed");
  localStorage.removeItem("push_banner_dismissed");
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("push_subscribed:")) localStorage.removeItem(key);
  }
}

export async function reconcilePushSubscriptionOwner(restaurantId: string): Promise<boolean> {
  if (isAlreadySubscribed(restaurantId) || !("serviceWorker" in navigator)) return true;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const detached = await Promise.all(
      registrations.map(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return true;

        try {
          if (await subscription.unsubscribe()) return true;
        } catch {
          // Fall through to disabling this worker registration.
        }

        return registration.unregister();
      }),
    );
    if (detached.some((result) => result !== true)) return false;
    clearPushSubscriptionMarkers();
    return true;
  } catch (error) {
    console.error("Push owner reconciliation failed:", error);
    return false;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  if (isLocalDevEnvironment()) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error("SW registration failed:", err);
    return null;
  }
}

export async function subscribeToPush(restaurantId: string): Promise<{ success: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: "VAPID key not configured" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Permission denied" };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: "Service Worker registration failed" };
    }

    let existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription && !isAlreadySubscribed(restaurantId)) {
      await existingSubscription.unsubscribe();
      existingSubscription = null;
    }
    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    await vaptApiRequest<{ restaurantId: string; endpoint: string; status: "subscribed" }>({
      route: "ingest/push-subscription",
      body: {
        subscription: subscription.toJSON(),
        endpoint: subscription.endpoint,
        origin: window.location.origin,
        user_agent: navigator.userAgent,
      },
    });

    clearPushSubscriptionMarkers();
    localStorage.setItem(pushSubscriptionKey(restaurantId), "true");

    return { success: true };
  } catch (err: unknown) {
    console.error("Push subscription failed:", err);

    const message = err instanceof Error ? err.message : String(err ?? "");
    const name = err instanceof Error ? err.name : "";

    if (message.includes("push service error")) {
      return {
        success: false,
        error:
          "O navegador não conseguiu registrar notificações push. No Brave, ative o uso de serviços do Google para push ou teste no Chrome.",
      };
    }

    if (name === "NotSupportedError") {
      return {
        success: false,
        error: "Este navegador não oferece suporte completo a notificações push neste contexto.",
      };
    }

    return { success: false, error: message || "Unknown error" };
  }
}
