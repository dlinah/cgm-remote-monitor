import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchLatestSettingsFromDb } from "@/lib/insulinSettings";

export interface InsulinProfile {
  id: string;
  name: string;
  carbRatio: number;
  isf: number;
  targetBg: number;
  insulinDuration: number;
}

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
const PROFILES_STORAGE_KEY = "insulin-profiles";

const defaultProfile: InsulinProfile = {
  id: "default",
  name: "Default",
  carbRatio: 10,
  isf: 50,
  targetBg: 100,
  insulinDuration: 4,
};

interface ProfilesState {
  activeId: string;
  profiles: InsulinProfile[];
}

const loadProfilesState = (): ProfilesState => {
  try {
    const stored = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.profiles?.length) return parsed;
    }
  } catch {}
  return { activeId: defaultProfile.id, profiles: [defaultProfile] };
};

const loadNightscout = () => {
  try {
    const stored = localStorage.getItem(NIGHTSCOUT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (s: Settings) => void;
  profiles: InsulinProfile[];
  activeProfileId: string;
  switchProfile: (id: string) => void;
  addProfile: (name: string) => void;
  deleteProfile: (id: string) => void;
}

const defaultSettings: Settings = {
  ...defaultProfile,
  nightscoutUrl: "",
  nightscoutSecret: "",
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  updateSettings: () => {},
  profiles: [defaultProfile],
  activeProfileId: defaultProfile.id,
  switchProfile: () => {},
  addProfile: () => {},
  deleteProfile: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [nightscout, setNightscout] = useState<{ nightscoutUrl: string; nightscoutSecret: string }>(() => {
    const ns = loadNightscout();
    return {
      nightscoutUrl: ns.nightscoutUrl ?? defaultNightscoutUrl,
      nightscoutSecret: ns.nightscoutSecret ?? "",
    };
  });

  const [profilesState, setProfilesState] = useState<ProfilesState>(loadProfilesState);

  useEffect(() => {
    try {
      localStorage.setItem(NIGHTSCOUT_STORAGE_KEY, JSON.stringify(nightscout));
    } catch {}
  }, [nightscout.nightscoutUrl, nightscout.nightscoutSecret]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profilesState));
    } catch {}
  }, [profilesState]);

  const activeProfile =
    profilesState.profiles.find((p) => p.id === profilesState.activeId) ??
    profilesState.profiles[0];

  const settings: Settings = { ...activeProfile, ...nightscout };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!nightscout.nightscoutUrl) return;
      const result = await fetchLatestSettingsFromDb(
        nightscout.nightscoutUrl,
        nightscout.nightscoutSecret
      );
      if (cancelled || !result.ok || !result.settings) return;
      const { carbRatio, isf, targetBg, insulinDuration } = result.settings as Partial<InsulinProfile>;
      setProfilesState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === prev.activeId
            ? {
                ...p,
                ...(carbRatio != null && { carbRatio }),
                ...(isf != null && { isf }),
                ...(targetBg != null && { targetBg }),
                ...(insulinDuration != null && { insulinDuration }),
              }
            : p
        ),
      }));
    };
    load();
    return () => { cancelled = true; };
  }, [nightscout.nightscoutUrl, nightscout.nightscoutSecret]);

  const updateSettings = (s: Settings) => {
    const { nightscoutUrl, nightscoutSecret, carbRatio, isf, targetBg, insulinDuration } = s;
    setNightscout({ nightscoutUrl, nightscoutSecret });
    setProfilesState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeId ? { ...p, carbRatio, isf, targetBg, insulinDuration } : p
      ),
    }));
  };

  const switchProfile = (id: string) => {
    setProfilesState((prev) => ({ ...prev, activeId: id }));
  };

  const addProfile = (name: string) => {
    const newProfile: InsulinProfile = {
      id: `profile-${Date.now()}`,
      name,
      carbRatio: activeProfile.carbRatio,
      isf: activeProfile.isf,
      targetBg: activeProfile.targetBg,
      insulinDuration: activeProfile.insulinDuration,
    };
    setProfilesState((prev) => ({
      activeId: newProfile.id,
      profiles: [...prev.profiles, newProfile],
    }));
  };

  const deleteProfile = (id: string) => {
    setProfilesState((prev) => {
      if (prev.profiles.length <= 1) return prev;
      const profiles = prev.profiles.filter((p) => p.id !== id);
      const activeId = prev.activeId === id ? profiles[0].id : prev.activeId;
      return { activeId, profiles };
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        profiles: profilesState.profiles,
        activeProfileId: profilesState.activeId,
        switchProfile,
        addProfile,
        deleteProfile,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
