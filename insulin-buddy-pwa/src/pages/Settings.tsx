import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings, Settings as SettingsType } from "@/contexts/SettingsContext";
import { saveSettingsToDb, stripNightscoutFromSettings } from "@/lib/insulinSettings";
import { toast } from "sonner";

const SettingsPage = () => {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<SettingsType>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [savingNightscout, setSavingNightscout] = useState(false);

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
