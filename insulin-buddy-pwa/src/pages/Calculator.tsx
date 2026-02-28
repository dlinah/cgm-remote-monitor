import { useState, useMemo, useEffect, useCallback } from "react";
import { Settings as SettingsIcon, Droplets, RefreshCw, Loader2, ListChecks, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { calculateDose } from "@/lib/insulin";
import { logToNightscout, fetchLatestGlucose, fetchIOB } from "@/lib/nightscout";
import { toast } from "sonner";

const Calculator = () => {
  const { settings } = useSettings();
  const [mealCarbs, setMealCarbs] = useState("");
  const [currentBg, setCurrentBg] = useState("");
  const [iob, setIob] = useState(0);
  const [iobCarb, setIobCarb] = useState(0);
  const [iobCorr, setIobCorr] = useState(0);
  const [showDoseDetails, setShowDoseDetails] = useState(false);
  const [totalDoseInput, setTotalDoseInput] = useState("");
  const [totalDoseTouched, setTotalDoseTouched] = useState(false);
  const [logging, setLogging] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [bgAge, setBgAge] = useState<string | null>(null);

  const nsConfigured = Boolean(settings.nightscoutUrl && settings.nightscoutSecret);

  const fetchFromNightscout = useCallback(async () => {

    if (!nsConfigured) return;
    setFetching(true);

    const [bgResult, iobResult] = await Promise.all([
      fetchLatestGlucose(settings.nightscoutUrl, settings.nightscoutSecret),
      fetchIOB(settings.nightscoutUrl, settings.nightscoutSecret, settings.insulinDuration),
    ]);

    if (bgResult.ok && bgResult.sgv != null) {
      setCurrentBg(String(bgResult.sgv));
      if (bgResult.dateString) {
        const mins = Math.round((Date.now() - new Date(bgResult.dateString).getTime()) / 60000);
        setBgAge(mins <= 1 ? "just now" : `${mins}m ago`);
      }
    } else if (bgResult.error) {
      toast.error(`BG fetch failed: ${bgResult.error}`);
    }

    if (iobResult.ok && iobResult.iob != null) {
      setIob(iobResult.iob);
      setIobCarb(iobResult.iobCarb ?? 0);
      setIobCorr(iobResult.iobCorr ?? 0);
    } else if (iobResult.error) {
      toast.error(`IOB fetch failed: ${iobResult.error}`);
    }

    setFetching(false);
  }, [settings, nsConfigured]);

  useEffect(() => {
    fetchFromNightscout();
  }, [fetchFromNightscout]);

  const dose = useMemo(() => {
    const carbs = parseFloat(mealCarbs) || 0;
    const bg = parseFloat(currentBg) || settings.targetBg;
    return calculateDose(
      carbs,
      settings.carbRatio,
      bg,
      settings.targetBg,
      settings.isf,
      iobCarb,
      iobCorr
    );
  }, [mealCarbs, currentBg, iobCarb, iobCorr, settings]);

  const carbsValue = parseFloat(mealCarbs) || 0;
  const bgValue = parseFloat(currentBg) || settings.targetBg;
  const rawCorrection = settings.isf > 0 ? (bgValue - settings.targetBg) / settings.isf : 0;
  const iobTotal = iobCarb + iobCorr;

  useEffect(() => {
    if (!totalDoseTouched) {
      setTotalDoseInput(dose.totalDose.toFixed(1));
    }
  }, [dose.totalDose, totalDoseTouched]);

  const hasInput = parseFloat(mealCarbs) > 0 || parseFloat(currentBg) > 0;

  const handleLog = async () => {
    if (!nsConfigured) {
      toast.error("Configure Nightscout in Settings first");
      return;
    }
    setLogging(true);
    const totalValue = parseFloat(totalDoseInput);
    const safeTotal = Number.isFinite(totalValue) ? totalValue : 0;
    const result = await logToNightscout(
      settings.nightscoutUrl,
      settings.nightscoutSecret,
      safeTotal,
      parseFloat(mealCarbs) || 0,
      `Carb: ${dose.carbDose}U, Correction: ${dose.correction}U, IOB: ${dose.iob}U, Total: ${safeTotal}U`
    );
    setLogging(false);
    if (result.ok) {
      toast.success("Logged to Nightscout");
      setMealCarbs("");
      setTotalDoseInput("");
      setTotalDoseTouched(false);
      fetchFromNightscout();
    } else {
      toast.error(`Failed: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </a>
            <Droplets className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">InsulinCalc</h1>
          </div>
          <div className="flex items-center gap-1">
            {nsConfigured && (
              <button
                onClick={fetchFromNightscout}
                disabled={fetching}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Refresh from Nightscout"
              >
                {fetching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
              </button>
            )}
            <Link
              to="/treatments"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Treatments"
            >
              <ListChecks className="h-5 w-5" />
            </Link>
            <Link
              to="/settings"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container max-w-lg py-6 space-y-5 animate-fade-in">
        {/* Dose Display */}
        <button
          type="button"
          className="section-card text-center w-full cursor-pointer transition-colors hover:bg-muted/40"
          onClick={() => setShowDoseDetails((prev) => !prev)}
          aria-expanded={showDoseDetails}
          aria-controls="dose-details"
        >
          <p className="dose-label mb-2">Recommended Dose</p>
          <p className="dose-value">{hasInput ? dose.totalDose.toFixed(1) : "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">units</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {showDoseDetails ? "Hide calculation details" : "Show calculation details"}
          </p>
        </button>

        {/* Dose Details */}
        {hasInput && showDoseDetails && (
          <div id="dose-details" className="section-card space-y-4 animate-fade-in">
            <h2 className="text-sm font-semibold text-foreground">How this dose was calculated</h2>

            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Meal Carbs</span>
                <span className="font-mono text-foreground">{carbsValue.toFixed(1)} g</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Current BG</span>
                <span className="font-mono text-foreground">
                  {bgValue.toFixed(0)} mg/dL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Target BG</span>
                <span className="font-mono text-foreground">{settings.targetBg} mg/dL</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Carb Ratio</span>
                <span className="font-mono text-foreground">1:{settings.carbRatio}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>ISF</span>
                <span className="font-mono text-foreground">{settings.isf}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>IOB (carb / corr)</span>
                <span className="font-mono text-foreground">
                  {iobCarb.toFixed(1)}U / {iobCorr.toFixed(1)}U
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>IOB total</span>
                <span className="font-mono text-foreground">{iobTotal.toFixed(1)}U</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Carb dose</span>
                <span className="font-mono text-foreground">
                  {carbsValue.toFixed(1)} ÷ {settings.carbRatio} = {dose.carbDose.toFixed(1)}U
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Raw correction</span>
                <span className="font-mono text-foreground">
                  ({bgValue.toFixed(0)} − {settings.targetBg}) ÷ {settings.isf} = {rawCorrection.toFixed(1)}U
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Correction after IOB</span>
                <span className="font-mono text-foreground">{dose.correction.toFixed(1)}U</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IOB adjustment</span>
                <span className="font-mono text-foreground">−{dose.iob.toFixed(1)}U</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-foreground font-semibold">Total</span>
                <span className="font-mono text-foreground">
                  {dose.carbDose.toFixed(1)} + {dose.correction.toFixed(1)} − {dose.iob.toFixed(1)} = {dose.totalDose.toFixed(1)}U
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown */}
        {hasInput && (
          <div className="grid grid-cols-3 gap-3 animate-fade-in">
            <div className="section-card text-center">
              <p className="dose-label mb-1">Carb</p>
              <p className="font-mono text-xl font-bold text-foreground">
                {dose.carbDose.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">units</p>
            </div>
            <div className="section-card text-center">
              <p className="dose-label mb-1">Correction</p>
              <p
                className="font-mono text-xl font-bold"
                style={{
                  color:
                    dose.correction > 0
                      ? "hsl(var(--dose-negative))"
                      : dose.correction < 0
                        ? "hsl(var(--dose-positive))"
                        : undefined,
                }}
              >
                {dose.correction > 0 ? "+" : ""}
                {dose.correction.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">units</p>
            </div>
            <div className="section-card text-center">
              <p className="dose-label mb-1">IOB</p>
              <p className="font-mono text-xl font-bold text-foreground">
                −{dose.iob.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">units</p>
            </div>
          </div>
        )}

        {/* Inputs */}
        <div className="section-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Meal & Glucose</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Meal Carbs (g)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input-field w-full"
              placeholder="0"
              value={mealCarbs}
              onChange={(e) => setMealCarbs(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Current Blood Glucose (mg/dL)
              </label>
              {bgAge && (
                <span className="text-xs text-muted-foreground">{bgAge}</span>
              )}
            </div>
            <input
              type="number"
              inputMode="decimal"
              className="input-field w-full"
              placeholder={String(settings.targetBg)}
              value={currentBg}
              onChange={(e) => {
                setCurrentBg(e.target.value);
                setBgAge(null);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Recommended Dose (units)
            </label>
            <input
              type="number"
              step="1"
              inputMode="decimal"
              className="input-field w-full"
              placeholder={dose.totalDose.toFixed()}
              value={parseFloat(totalDoseInput).toFixed() || ""}
              onChange={(e) => {
                setTotalDoseInput(e.target.value);
                setTotalDoseTouched(true);
              }}
              onBlur={() => {
                const value = parseFloat(totalDoseInput);
                if (Number.isFinite(value)) {
                  setTotalDoseInput(value.toFixed());
                }
              }}
            />
          </div>
        </div>

        {/* IOB & Settings Summary */}
        <div className="section-card">
          <h2 className="text-sm font-semibold text-foreground mb-3">Active Parameters</h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">IOB</p>
              <p className="font-mono text-sm font-semibold text-foreground">{iob.toFixed(1)}U</p>
              {nsConfigured && (
                <p className="text-[10px] text-muted-foreground">from NS</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Carb Ratio</p>
              <p className="font-mono text-sm font-semibold text-foreground">1:{settings.carbRatio}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ISF</p>
              <p className="font-mono text-sm font-semibold text-foreground">{settings.isf}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target BG</p>
              <p className="font-mono text-sm font-semibold text-foreground">{settings.targetBg}</p>
            </div>
          </div>
        </div>

        {/* Not configured hint */}
        {!nsConfigured && (
          <div className="rounded-xl border border-border bg-accent/50 p-4 text-center">
            <p className="text-sm text-accent-foreground">
              Connect to{" "}
              <Link to="/settings" className="font-semibold underline underline-offset-2">
                Nightscout in Settings
              </Link>{" "}
              to auto-fetch BG & IOB
            </p>
          </div>
        )}

        {/* Nightscout Button */}
        {hasInput && nsConfigured && (
          <button
            onClick={handleLog}
            disabled={logging}
            className="w-full rounded-xl bg-secondary py-3.5 text-sm font-semibold text-secondary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {logging ? "Sending…" : "Send to Nightscout"}
          </button>
        )}
      </main>
    </div>
  );
};

export default Calculator;
