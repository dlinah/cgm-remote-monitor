import type { Settings } from "@/contexts/SettingsContext";
import { buildHeaders, baseUrl } from "@/lib/nightscout";

export interface SettingsSaveResult {
  ok: boolean;
  error?: string;
}

export interface SettingsFetchResult {
  ok: boolean;
  settings?: Partial<Settings>;
  error?: string;
}

export type StoredSettings = Omit<Settings, "nightscoutUrl" | "nightscoutSecret">;

export function stripNightscoutFromSettings(settings: Settings): StoredSettings {
  // Nightscout credentials should stay local only.
  const { nightscoutUrl, nightscoutSecret, ...rest } = settings;
  return rest;
}

export async function saveSettingsToDb(
  settings: StoredSettings,
  nsUrl: string,
  secret?: string
): Promise<SettingsSaveResult> {
  try {
    const headers = secret
      ? await buildHeaders(secret)
      : { "Content-Type": "application/json" };
    const response = await fetch(`${baseUrl(nsUrl)}/api/v1/insulinsettings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app: "insulin-buddy-pwa",
        created_at: new Date().toISOString(),
        settings,
      }),
    });

    if (!response.ok) {
      console.error("Failed to save settings to API", response.status, response.statusText);
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error: any) {
    console.error("Save settings error", error);
    return { ok: false, error: error?.message || "Network error" };
  }
}

export async function fetchLatestSettingsFromDb(
  nsUrl: string,
  secret?: string
): Promise<SettingsFetchResult> {
  try {
    const headers = secret
      ? await buildHeaders(secret)
      : { "Content-Type": "application/json" };
    const response = await fetch(
      `${baseUrl(nsUrl)}/api/v1/insulinsettings?count=1`,
      { headers }
    );

    if (!response.ok) {
      console.error("Failed to fetch settings from API", response.status, response.statusText);
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const latest = Array.isArray(data) ? data[0] : data;
    const settings = latest?.settings ?? null;
    if (!settings) {
      return { ok: true };
    }

    return { ok: true, settings };
  } catch (error: any) {
    console.error("Fetch settings error", error);
    return { ok: false, error: error?.message || "Network error" };
  }
}
