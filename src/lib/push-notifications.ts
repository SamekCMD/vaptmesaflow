// Web Push notification utilities

// VAPID public key — replace with your generated key
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// N8N webhook URL for saving push subscriptions
const PUSH_SUBSCRIBE_WEBHOOK = import.meta.env.VITE_PUSH_SUBSCRIBE_WEBHOOK || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isPushDismissed(): boolean {
  return localStorage.getItem('push_banner_dismissed') === 'true';
}

export function dismissPushBanner(): void {
  localStorage.setItem('push_banner_dismissed', 'true');
}

export function isAlreadySubscribed(): boolean {
  return localStorage.getItem('push_subscribed') === 'true';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(
  restaurantId: string
): Promise<{ success: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: 'VAPID key not configured' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Service Worker registration failed' };
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Send subscription to n8n webhook
    if (PUSH_SUBSCRIBE_WEBHOOK) {
      await fetch(PUSH_SUBSCRIBE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          subscription: subscription.toJSON(),
        }),
      });
    }

    localStorage.setItem('push_subscribed', 'true');
    dismissPushBanner();

    return { success: true };
  } catch (err: any) {
    console.error('Push subscription failed:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
