import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Settings {
  carbRatio: number;
  isf: number;
  targetBg: number;
  insulinDuration: number; // hours for IOB decay
  nightscoutUrl: string;
  nightscoutSecret: string;
}

const defaultSettings: Settings = {
  carbRatio: 10,
  isf: 50,
  targetBg: 100,
  insulinDuration: 4,
  nightscoutUrl: "",
  nightscoutSecret: "",
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (s: Settings) => void;
}>({ settings: defaultSettings, updateSettings: () => {} });

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem("insulin-settings");
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem("insulin-settings", JSON.stringify(settings));
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings: setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
