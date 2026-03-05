import { useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings, Settings as SettingsType } from "@/contexts/SettingsContext";
import { saveSettingsToDb, stripNightscoutFromSettings } from "@/lib/insulinSettings";
import { toast } from "sonner";

const SettingsPage = () => {
  const { settings, updateSettings, profiles, activeProfileId, switchProfile, addProfile, deleteProfile } = useSettings();
  const [form, setForm] = useState<SettingsType>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [savingNightscout, setSavingNightscout] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const update = (key: keyof SettingsType, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: ["carbRatio", "isf", "targetBg", "insulinDuration"].includes(key) ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = async () => {
    if (form.carbRatio <= 0 || form.isf <= 0 || form.targetBg <= 0) {
      toast.error("Ratios must be greater than 0");
      return;
    }
    updateSettings(form);
    setSaving(true);
    const result = await saveSettingsToDb(
      stripNightscoutFromSettings(form),
      form.nightscoutUrl,
      form.nightscoutSecret
    );
    setSaving(false);
    if (result.ok) {
      toast.success("Settings saved");
    } else {
      console.error("Settings save failed", result.error);
      toast.error(`Save failed: ${result.error}`);
    }
  };

  const handleSaveNightscout = () => {
    setSavingNightscout(true);
    updateSettings({
      ...settings,
      nightscoutUrl: form.nightscoutUrl,
      nightscoutSecret: form.nightscoutSecret,
    });
    setSavingNightscout(false);
    toast.success("Nightscout settings saved locally");
  };

  const handleAddProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    addProfile(name);
    setNewProfileName("");
    setAddingProfile(false);
  };

  const handleDeleteProfile = () => {
    if (profiles.length <= 1) return;
    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!confirm(`Delete profile "${profile?.name}"?`)) return;
    deleteProfile(activeProfileId);
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex items-center gap-3 py-3">
          <Link
            to="/"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-foreground">Settings</h1>
        </div>
      </header>

      <main className="container max-w-lg py-6 space-y-5 animate-fade-in">
        {/* Profiles */}
        <div className="section-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Profiles</h2>

          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                data-profile-id={p.id}
                onClick={() => switchProfile(p.id)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  p.id === activeProfileId
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <span>{p.name}</span>
                {p.id === activeProfileId && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>

          {addingProfile ? (
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Profile name"
                value={newProfileName}
                autoFocus
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProfile(); if (e.key === "Escape") setAddingProfile(false); }}
                data-testid="new-profile-input"
              />
              <button
                onClick={handleAddProfile}
                disabled={!newProfileName.trim()}
                className="rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => { setAddingProfile(false); setNewProfileName(""); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setAddingProfile(true)}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                New Profile
              </button>
              {profiles.length > 1 && (
                <button
                  onClick={handleDeleteProfile}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                  data-testid="delete-profile-btn"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete "{activeProfile?.name}"
                </button>
              )}
            </div>
          )}
        </div>

        {/* Insulin Parameters */}
        <div className="section-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Insulin Parameters</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Carbohydrate Ratio (g per 1U)
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="input-field w-full"
              value={form.carbRatio || ""}
              onChange={(e) => update("carbRatio", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Insulin Sensitivity Factor (mg/dL per 1U)
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="input-field w-full"
              value={form.isf || ""}
              onChange={(e) => update("isf", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Target Blood Glucose (mg/dL)
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="input-field w-full"
              value={form.targetBg || ""}
              onChange={(e) => update("targetBg", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Insulin Action Duration (hours)
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="input-field w-full"
              value={form.insulinDuration || ""}
              onChange={(e) => update("insulinDuration", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Used to calculate IOB decay (typically 3–5 hrs)</p>
          </div>
        </div>

        {/* Nightscout */}
        <div className="section-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Nightscout</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Base URL</label>
            <input
              type="url"
              className="input-field w-full"
              placeholder="https://your-nightscout.herokuapp.com"
              value={form.nightscoutUrl}
              onChange={(e) => update("nightscoutUrl", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              API Secret or Token
            </label>
            <input
              type="password"
              className="input-field w-full"
              placeholder="Your API secret or token"
              value={form.nightscoutSecret}
              onChange={(e) => update("nightscoutSecret", e.target.value)}
            />
          </div>

          <button
            onClick={handleSaveNightscout}
            disabled={savingNightscout}
            className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
          >
            {savingNightscout ? "Saving..." : "Save Nightscout"}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </main>
    </div>
  );
};

export default SettingsPage;
