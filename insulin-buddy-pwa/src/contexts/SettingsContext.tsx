import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchLatestSettingsFromDb } from "@/lib/insulinSettings";

export interface Settings {
  carbRatio: number;
  isf: number;
  targetBg: number;
  insulinDuration: number; // hours for IOB decay
  nightscoutUrl: string;
  nightscoutSecret: string;
}

const isDev = process.env.NODE_ENV === "development";

const defaultNightscoutUrl = (() => {
  if (isDev) return "http://localhost:7880/";
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
})();

const NIGHTSCOUT_STORAGE_KEY = "insulin-nightscout";

const defaultSettings: Settings = {
  carbRatio: 10,
  isf: 50,
  targetBg: 100,
  insulinDuration: 4,
  nightscoutUrl: defaultNightscoutUrl,
  nightscoutSecret: "",
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (s: Settings) => void;
}>({ settings: defaultSettings, updateSettings: () => { } });

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(NIGHTSCOUT_STORAGE_KEY);
      const nightscout = stored ? JSON.parse(stored) : {};
      return { ...defaultSettings, ...nightscout };
    } catch (e) {
      console.error("Failed to read Nightscout settings from local storage", e);
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      const { nightscoutUrl, nightscoutSecret } = settings;
      localStorage.setItem(
        NIGHTSCOUT_STORAGE_KEY,
        JSON.stringify({ nightscoutUrl, nightscoutSecret })
      );
    } catch (e) {
      console.error("Failed to save Nightscout settings to local storage", e);
    }
  }, [settings.nightscoutUrl, settings.nightscoutSecret]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!settings.nightscoutUrl) return;
      const result = await fetchLatestSettingsFromDb(
        settings.nightscoutUrl,
        settings.nightscoutSecret
      );
      if (cancelled) return;
      if (!result.ok) {
        console.error("Failed to load settings from API", result.error);
        return;
      }
      if (!result.settings) return;
      const { nightscoutUrl, nightscoutSecret, ...rest } = result.settings;
      setSettings((prev) => ({ ...prev, ...rest }));
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [settings.nightscoutUrl, settings.nightscoutSecret]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings: setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
