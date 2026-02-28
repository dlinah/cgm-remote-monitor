// --- Auth helpers ---

import { sha1 } from "js-sha1";

async function sha1Hex(message: string): Promise<string> {
  const webCrypto = globalThis.crypto;

  if (webCrypto?.subtle && globalThis.isSecureContext) {
    try {
      const data = new TextEncoder().encode(message);
      const hashBuffer = await webCrypto.subtle.digest("SHA-1", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fall through to JS implementation below.
    }
  }

  return sha1(message);
}

export async function buildHeaders(secret: string): Promise<Record<string, string>> {
  const hashedSecret = await sha1Hex(secret);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "api-secret": hashedSecret,
  };

  return headers;
}

export function baseUrl(url: string) {
  return url?.replace(/\/+$/, "");
}

// --- Log treatment ---

export async function logToNightscout(
  nsUrl: string,
  secret: string,
  insulin: number,
  carbs: number,
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers = await buildHeaders(secret);
    const response = await fetch(`${baseUrl(nsUrl)}/api/v1/treatments` + `?api_secret=${secret}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        eventType: "Bolus",
        insulin,
        carbs,
        created_at: new Date().toISOString(),
        notes,
      }),
    });

    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true };
  } catch (e: any) {
    console.error("logToNightscout error:", e);
    return { ok: false, error: e.message || "Network error" };
  }
}

// --- Fetch latest glucose (sgv) ---

export async function fetchLatestGlucose(
  nsUrl: string,
  secret: string
): Promise<{ ok: boolean; sgv?: number; dateString?: string; error?: string }> {
  try {
    const headers = await buildHeaders(secret);
    const res = await fetch(`${baseUrl(nsUrl)}/api/v1/entries.json?count=1`, { headers });
    console.log('...')
    console.log(res)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: "No glucose entries found" };
    }

    const entry = data[0];
    return {
      ok: true,
      sgv: entry.sgv,
      dateString: entry.dateString || new Date(entry.date).toISOString(),
    };
  } catch (e: any) {
    console.error("fetchLatestGlucose error:", e);
    return { ok: false, error: e.message || "Network error" };
  }
}

// --- Calculate IOB from recent bolus treatments ---

interface Treatment {
  insulin?: number;
  carbs?: number;
  created_at: string;
  eventType?: string;
}

/**
 * Fetches recent bolus treatments and calculates remaining IOB
 * using a simple linear decay model over `durationHours`.
 */
export async function fetchIOB(
  nsUrl: string,
  secret: string,
  durationHours: number = 4
): Promise<{
  ok: boolean;
  iob?: number;
  iobCarb?: number;
  iobCorr?: number;
  treatments?: Treatment[];
  error?: string;
}> {
  try {
    const headers = await buildHeaders(secret);
    const since = new Date(Date.now() - durationHours * 60 * 60 * 1000).toISOString();

    const res = await fetch(
      `${baseUrl(nsUrl)}/api/v1/treatments.json?count=100&find[created_at][$gte]=${encodeURIComponent(since)}&find[insulin][$gt]=0`,
      { headers }
    );

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const treatments: Treatment[] = await res.json();
    console.log('fetchIOB response:', treatments);
    const now = Date.now();
    const durationMs = durationHours * 60 * 60 * 1000;
    let iob = 0;
    let iobCarb = 0;
    let iobCorr = 0;
    for (const t of treatments) {
      if (!t.insulin || t.insulin <= 0) continue;
      const elapsed = now - new Date(t.created_at).getTime();
      if (elapsed < 0 || elapsed >= durationMs) continue;
      // Linear decay: remaining = insulin * (1 - elapsed/duration)
      const remaining = t.insulin * (1 - elapsed / durationMs);
      iob += remaining;
      if ((t.carbs ?? 0) > 0) {
        iobCarb += remaining;
      } else {
        iobCorr += remaining;
      }
      console.log('Processing treatment:', t, iob);
    }

    const roundedIob = Math.round(iob * 100) / 100;
    const roundedIobCarb = Math.round(iobCarb * 100) / 100;
    const roundedIobCorr = Math.round(iobCorr * 100) / 100;

    return {
      ok: true,
      iob: roundedIob,
      iobCarb: roundedIobCarb,
      iobCorr: roundedIobCorr,
      treatments,
    };
  } catch (e: any) {
    console.error("fetchIOB error:", e);
    return { ok: false, error: e.message || "Network error" };
  }
}
