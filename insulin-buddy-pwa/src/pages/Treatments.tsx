import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Loader2, Trash2, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { fetchTreatments, updateTreatment, deleteTreatment, NsTreatment } from "@/lib/nightscout";
import { toast } from "sonner";

const TreatmentsPage = () => {
    const { settings } = useSettings();
    const [treatments, setTreatments] = useState<NsTreatment[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Partial<NsTreatment>>>({});

    const nsConfigured = Boolean(settings.nightscoutUrl && settings.nightscoutSecret);

    const filteredTreatments = useMemo(() => {
        return treatments.filter((t) => t.eventType === "Bolus" || (t.insulin ?? 0) > 0 || (t.carbs ?? 0) > 0);
    }, [treatments]);

    const loadTreatments = async () => {
        if (!nsConfigured) return;
        setLoading(true);
        const result = await fetchTreatments(settings.nightscoutUrl, settings.nightscoutSecret, 100);
        setLoading(false);
        if (result.ok && result.treatments) {
            setTreatments(result.treatments);
        } else {
            toast.error(`Load failed: ${result.error}`);
        }
    };

    useEffect(() => {
        loadTreatments();
    }, [settings.nightscoutUrl, settings.nightscoutSecret]);

    const updateDraft = (id: string, patch: Partial<NsTreatment>) => {
        setDrafts((prev) => ({
            ...prev,
            [id]: { ...prev[id], ...patch },
        }));
    };

    const handleSave = async (treatment: NsTreatment) => {
        if (!treatment._id) return;
        const draft = drafts[treatment._id] ?? {};
        const update = {
            eventType: treatment.eventType ?? "Bolus",
            created_at: treatment.created_at,
            insulin: Number(draft.insulin ?? treatment.insulin ?? 0),
            carbs: Number(draft.carbs ?? treatment.carbs ?? 0),
            notes: (draft.notes ?? treatment.notes ?? "").trim(),
        };

        setSavingId(treatment._id);
        const result = await updateTreatment(
            settings.nightscoutUrl,
            settings.nightscoutSecret,
            treatment._id,
            update
        );
        setSavingId(null);
        if (result.ok) {
            toast.success("Treatment updated");
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[treatment._id as string];
                return next;
            });
            setTreatments((prev) =>
                prev.map((t) => (t._id === treatment._id ? { ...t, ...update } : t))
            );
        } else {
            toast.error(`Update failed: ${result.error}`);
        }
    };

    const handleDelete = async (treatment: NsTreatment) => {
        if (!treatment._id) return;
        if (!confirm("Delete this treatment?")) return;
        setDeletingId(treatment._id);
        const result = await deleteTreatment(
            settings.nightscoutUrl,
            settings.nightscoutSecret,
            treatment._id
        );
        setDeletingId(null);
        if (result.ok) {
            toast.success("Treatment deleted");
            setTreatments((prev) => prev.filter((t) => t._id !== treatment._id));
        } else {
            toast.error(`Delete failed: ${result.error}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
                <div className="container flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-lg font-bold text-foreground">Treatments</h1>
                    </div>

                    <button
                        onClick={loadTreatments}
                        disabled={loading || !nsConfigured}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                        title="Refresh"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                    </button>
                </div>
            </header>

            <main className="container max-w-2xl py-6 space-y-4 animate-fade-in">
                {!nsConfigured && (
                    <div className="rounded-xl border border-border bg-accent/50 p-4 text-center">
                        <p className="text-sm text-accent-foreground">
                            Configure Nightscout in{" "}
                            <Link to="/settings" className="font-semibold underline underline-offset-2">
                                Settings
                            </Link>
                            {" "}to manage treatments.
                        </p>
                    </div>
                )}

                {nsConfigured && filteredTreatments.length === 0 && !loading && (
                    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                        No treatments found.
                    </div>
                )}

                {filteredTreatments.map((treatment) => {
                    const id = treatment._id ?? "";
                    const draft = drafts[id] ?? {};
                    const insulinValue = draft.insulin ?? treatment.insulin ?? "";
                    const carbsValue = draft.carbs ?? treatment.carbs ?? "";
                    const notesValue = draft.notes ?? treatment.notes ?? "";

                    return (
                        <div key={id} className="section-card space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {treatment.eventType || "Bolus"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(treatment.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleSave(treatment)}
                                        disabled={savingId === id || !id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                    >
                                        <Save className="h-3.5 w-3.5" />
                                        {savingId === id ? "Saving" : "Save"}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(treatment)}
                                        disabled={deletingId === id || !id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        {deletingId === id ? "Deleting" : "Delete"}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Insulin (U)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        className="input-field w-full"
                                        value={insulinValue}
                                        onChange={(e) => updateDraft(id, { insulin: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Carbs (g)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        className="input-field w-full"
                                        value={carbsValue}
                                        onChange={(e) => updateDraft(id, { carbs: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <label className="text-xs font-medium text-muted-foreground">Notes</label>
                                    <input
                                        type="text"
                                        className="input-field w-full"
                                        value={notesValue}
                                        onChange={(e) => updateDraft(id, { notes: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>
        </div>
    );
};

export default TreatmentsPage;
