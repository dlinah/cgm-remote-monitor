import type { Settings } from "@/contexts/SettingsContext";

export interface SettingsSaveResult {
  ok: boolean;
  error?: string;
}

export async function saveSettingsToDb(
  settings: Settings
): Promise<SettingsSaveResult> {
  try {
    const response = await fetch("/api/v1/insulinsettings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.nightscoutSecret
          ? { "api-secret": settings.nightscoutSecret }
          : {}),
      },
      body: JSON.stringify({
        app: "insulin-buddy-pwa",
        created_at: new Date().toISOString(),
        settings,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Network error" };
  }
}
