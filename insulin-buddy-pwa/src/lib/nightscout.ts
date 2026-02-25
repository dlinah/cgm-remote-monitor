// --- Auth helpers ---

function buildHeaders(secret: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "api_secret": secret };

  return headers;
}

function baseUrl(url: string) {
  return url.replace(/\/+$/, "");
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
    const headers =  buildHeaders(secret);
    const response = await fetch(`${baseUrl(nsUrl)}/api/v1/treatments`, {
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
    const headers = buildHeaders(secret);
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
): Promise<{ ok: boolean; iob?: number; treatments?: Treatment[]; error?: string }> {
  try {
    const headers = await buildHeaders(secret);
    const since = new Date(Date.now() - durationHours * 60 * 60 * 1000).toISOString();

    const res = await fetch(
      `${baseUrl(nsUrl)}/api/v1/treatments.json?count=100&find[created_at][$gte]=${encodeURIComponent(since)}&find[insulin][$gt]=0`,
      { headers }
    );

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const treatments: Treatment[] = await res.json();
    const now = Date.now();
    const durationMs = durationHours * 60 * 60 * 1000;

    let iob = 0;
    for (const t of treatments) {
      if (!t.insulin || t.insulin <= 0) continue;
      const elapsed = now - new Date(t.created_at).getTime();
      if (elapsed < 0 || elapsed >= durationMs) continue;
      // Linear decay: remaining = insulin * (1 - elapsed/duration)
      const remaining = t.insulin * (1 - elapsed / durationMs);
      iob += remaining;
    }

    return { ok: true, iob: Math.round(iob * 100) / 100, treatments };
  } catch (e: any) {
    console.error("fetchIOB error:", e);
    return { ok: false, error: e.message || "Network error" };
  }
}
