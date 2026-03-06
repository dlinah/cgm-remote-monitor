import { buildHeaders, baseUrl } from "./nightscout";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getVapidPublicKey(nsUrl: string, secret: string): Promise<string | null> {
  try {
    const headers = await buildHeaders(secret);
    const res = await fetch(`${baseUrl(nsUrl)}/api/v1/push/vapidPublicKey`, { headers });
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    return publicKey || null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(
  nsUrl: string,
  secret: string
): Promise<{ ok: boolean; error?: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Push not supported in this browser" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notification permission denied" };
  }

  const publicKey = await getVapidPublicKey(nsUrl, secret);
  if (!publicKey) return { ok: false, error: "Could not fetch VAPID key from server" };

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const headers = await buildHeaders(secret);
    headers["Content-Type"] = "application/json";
    const res = await fetch(`${baseUrl(nsUrl)}/api/v1/push/subscribe`, {
      method: "POST",
      headers,
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!res.ok) return { ok: false, error: `Server error: HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || "Subscription failed" };
  }
}

export async function unsubscribeFromPush(
  nsUrl: string,
  secret: string
): Promise<{ ok: boolean; error?: string }> {
  if (!("serviceWorker" in navigator)) return { ok: false, error: "Not supported" };

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return { ok: true };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const headers = await buildHeaders(secret);
    headers["Content-Type"] = "application/json";
    await fetch(`${baseUrl(nsUrl)}/api/v1/push/subscribe`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ endpoint }),
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || "Unsubscribe failed" };
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

export async function sendPushNotification(
  nsUrl: string,
  secret: string,
  dose: number
): Promise<void> {
  try {
    const headers = await buildHeaders(secret);
    headers["Content-Type"] = "application/json";
    await fetch(`${baseUrl(nsUrl)}/api/v1/push/notify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Insulin Reminder",
        body: `Recommended dose: ${dose.toFixed(1)} units`,
        dose: dose.toFixed(1),
      }),
    });
  } catch {
    // best-effort — don't throw
  }
}
