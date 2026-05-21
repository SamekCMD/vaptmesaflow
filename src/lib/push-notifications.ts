import { ENV } from "@/lib/env";
import { n8nClient } from "@/lib/n8n-client";

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

export function isPushDismissed(): boolean {
  return localStorage.getItem("push_banner_dismissed") === "true";
}

export function dismissPushBanner(): void {
  localStorage.setItem("push_banner_dismissed", "true");
}

export function isAlreadySubscribed(): boolean {
  return localStorage.getItem("push_subscribed") === "true";
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

export async function subscribeToPush(
  restaurantId: string
): Promise<{ success: boolean; error?: string }> {
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

    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    await n8nClient.ingest.pushSubscription({
      restaurant_id: restaurantId,
      subscription: subscription.toJSON(),
      endpoint: subscription.endpoint,
      origin: window.location.origin,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    });

    localStorage.setItem("push_subscribed", "true");
    dismissPushBanner();

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
