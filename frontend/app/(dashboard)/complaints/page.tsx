// app/(dashboard)/complaints/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Search,
    ChevronRight,
    Package,
    Check,
    XCircle,
    Info,
    Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComplaintsApiResponse } from "@/app/api/(dashboard)/complaints/route";
import {
    FileComplaintModal,
    ManageComplaintsModal,
    type ComplaintFormValues,
    type ComplaintListItem,
    type ComplaintStatus,
} from "./ComplaintModal";

// ── Types ───────────────────────────────────────────────────────────────────

type UiStatus = "COMPLIANT" | "VIOLATION" | "UNCERTAIN";

type RegisterRecord = {
    id: string;
    product: string;
    status: UiStatus;
    timestamp: string;
    summary: string | null;
    imageCount: number;
    complaintCount: number;
    openComplaintCount: number;
};

const statusCopy: Record<UiStatus, string> = {
    COMPLIANT: "Compliant",
    VIOLATION: "Violation",
    UNCERTAIN: "Uncertain",
};

const statusStyles: Record<
    UiStatus,
    { text: string; bg: string; border: string; icon: React.ElementType }
> = {
    COMPLIANT: {
        text: "text-success",
        bg: "bg-success-soft",
        border: "border-success/20",
        icon: Check,
    },
    VIOLATION: {
        text: "text-destructive",
        bg: "bg-danger-soft",
        border: "border-destructive/20",
        icon: XCircle,
    },
    UNCERTAIN: {
        text: "text-warning",
        bg: "bg-warning-soft",
        border: "border-warning/20",
        icon: Info,
    },
};

function verdictToStatus(verdict: string): UiStatus {
    if (verdict === "PASS") return "COMPLIANT";
    if (verdict === "FAIL") return "VIOLATION";
    return "UNCERTAIN";
}

function StatusBadge({ status }: { status: UiStatus }) {
    const s = statusStyles[status];
    const Icon = s.icon;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${s.bg} ${s.text} ${s.border}`}
        >
            <Icon className="h-3 w-3" />
            {statusCopy[status]}
        </span>
    );
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ComplaintsPage() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"ALL" | UiStatus>("ALL");

    const [records, setRecords] = useState<RegisterRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [manageTarget, setManageTarget] = useState<RegisterRecord | null>(null);
    const [fileTarget, setFileTarget] = useState<RegisterRecord | null>(null);

    const [manageComplaints, setManageComplaints] = useState<ComplaintListItem[]>(
        [],
    );
    const [manageLoading, setManageLoading] = useState(false);

    // Load register — unchanged
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/complaints", { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = (await res.json()) as ComplaintsApiResponse;
                if (cancelled) return;
                setRecords(
                    body.records.map((r) => ({
                        id: r.id,
                        product: r.productName ?? "Untitled product",
                        status: verdictToStatus(r.verdict),
                        timestamp: r.createdAt,
                        summary: r.summary,
                        imageCount: r.imageCount,
                        complaintCount: r.complaintCount,
                        openComplaintCount: r.openComplaintCount,
                    })),
                );
            } catch (e) {
                if (!cancelled) setError("Could not load complaints.");
                console.error("[complaints] fetch failed:", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // Fetch complaints for manage modal — unchanged
    useEffect(() => {
        if (!manageTarget) return;
        let cancelled = false;
        (async () => {
            setManageLoading(true);
            try {
                const res = await fetch(`/api/complaints/${manageTarget.id}`, {
                    cache: "no-store",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = (await res.json()) as { complaints: ComplaintListItem[] };
                if (!cancelled) setManageComplaints(body.complaints);
            } catch (e) {
                if (!cancelled) setManageComplaints([]);
                console.error("[complaints] per-inspection fetch failed:", e);
            } finally {
                if (!cancelled) setManageLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [manageTarget]);

    const filtered = useMemo(() => {
        return records.filter((r) => {
            const q = search.toLowerCase();
            const matchesSearch =
                r.product.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
            const matchesFilter = filter === "ALL" || r.status === filter;
            return matchesSearch && matchesFilter;
        });
    }, [records, search, filter]);

    const stats = {
        total: records.length,
        compliant: records.filter((r) => r.status === "COMPLIANT").length,
        violation: records.filter((r) => r.status === "VIOLATION").length,
        complaintsOpen: records.reduce((n, r) => n + r.openComplaintCount, 0),
    };

    const metrics = [
        { label: "Records", value: stats.total, accent: "text-foreground" },
        { label: "Compliant", value: stats.compliant, accent: "text-success" },
        { label: "Violations", value: stats.violation, accent: "text-destructive" },
        {
            label: "Open complaints",
            value: stats.complaintsOpen,
            accent: "text-destructive",
        },
    ];

    // ── Handlers (unchanged) ─────────────────────────────────────────────────

    async function submitFile(values: ComplaintFormValues) {
        if (!fileTarget) return;
        const target = fileTarget;

        const res = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...values, inspectionId: target.id }),
        });
        if (!res.ok) throw new Error("Failed to file");

        // Bump counts locally (unchanged)
        setRecords((prev) =>
            prev.map((r) =>
                r.id === target.id
                    ? {
                        ...r,
                        complaintCount: r.complaintCount + 1,
                        openComplaintCount: r.openComplaintCount + 1,
                    }
                    : r,
            ),
        );

        // Close file modal, open manage for the same record → triggers the
        // [manageTarget] effect → GET /api/complaints/[id] → list appears.
        setFileTarget(null);
        setManageComplaints([]);
        setManageTarget(target);
    }

    async function updateStatus(id: string, status: ComplaintStatus) {
        const res = await fetch("/api/complaints", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status }),
        });
        if (!res.ok) throw new Error("Failed to update");
        setManageComplaints((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status } : c)),
        );
        setRecords((prev) =>
            prev.map((r) => {
                if (r.id !== manageTarget?.id) return r;
                const openDelta =
                    status === "OPEN" || status === "UNDER_REVIEW" ? 0 : -1;
                return {
                    ...r,
                    openComplaintCount: Math.max(0, r.openComplaintCount + openDelta),
                };
            }),
        );
    }

    function openManage(record: RegisterRecord) {
        setManageTarget(record);
        setManageComplaints([]);
    }

    function openFile(record: RegisterRecord) {
        setManageTarget(null);
        setFileTarget(record);
    }

    const filteredLabel =
        filter === "ALL" ? "All records" : statusCopy[filter as UiStatus];

    return (
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
            {/* ── Header ─────────────────────────────────────── */}
            <header className="pt-6 pb-6 sm:pt-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Compliance register
                </p>

                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                        <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[1.9rem]">
                            Complaints
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Filed complaints against verified inspection records.
                        </p>
                    </div>

                    <Button
                        onClick={() => {
                            if (filtered.length === 1) openFile(filtered[0]);
                            else {
                                const el = document.getElementById("complaints-list");
                                el?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        }}
                        className="w-full shrink-0 sm:w-auto"
                    >
                        <Plus className="h-4 w-4" />
                        File complaint
                    </Button>
                </div>
            </header>

            {/* ── Error ──────────────────────────────────────── */}
            {error && (
                <div className="mb-5 flex items-center justify-between gap-3 border-l-2 border-destructive bg-danger-soft/60 px-3 py-2 text-sm text-destructive">
                    <span className="truncate">Could not load complaints.</span>
                    <button
                        type="button"
                        onClick={() => setReloadKey((k) => k + 1)}
                        className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ── Stats strip ────────────────────────────────── */}
            <section className="border-y border-border">
                <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
                    {metrics.map((m, i) => (
                        <div
                            key={m.label}
                            className={`flex flex-col gap-1 px-4 py-4 sm:px-5 sm:py-5 ${i >= 2 ? "border-t border-border sm:border-t-0" : ""
                                }`}
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {m.label}
                            </span>
                            <span
                                className={`text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums ${m.accent}`}
                            >
                                {loading ? (
                                    <span className="inline-block h-6 w-8 animate-pulse rounded bg-muted align-middle" />
                                ) : (
                                    m.value
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Toolbar ────────────────────────────────────── */}
            <section className="py-5">
                <div className="flex h-11 items-center gap-1 rounded-lg border border-border bg-background px-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search products or record IDs…"
                            className="h-9 w-full rounded-md border-0 bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0"
                        />
                    </div>

                    <div className="h-6 w-px shrink-0 bg-border" />

                    <div className="flex items-center gap-0.5 overflow-x-auto px-0.5">
                        {(["ALL", "COMPLIANT", "VIOLATION", "UNCERTAIN"] as const).map(
                            (item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setFilter(item)}
                                    className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${filter === item
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                >
                                    {item === "ALL" ? "All" : statusCopy[item]}
                                </button>
                            ),
                        )}
                    </div>
                </div>
            </section>

            {/* ── Register list ──────────────────────────────── */}
            <section id="complaints-list" className="pb-10">
                <div className="mb-2 flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Register records
                        </p>
                        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-foreground">
                            {filteredLabel}
                            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                                ({filtered.length})
                            </span>
                        </h2>
                    </div>
                </div>

                <div className="border-t border-border">
                    {loading ? (
                        <ul>
                            {[0, 1, 2, 3].map((i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                                >
                                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-muted" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                                        <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                                    </div>
                                    <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                                </li>
                            ))}
                        </ul>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-sm font-medium text-foreground">
                                {search || filter !== "ALL"
                                    ? "No matching records"
                                    : "No records yet"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {search || filter !== "ALL"
                                    ? "Try adjusting your search or filters."
                                    : "Complete an inspection to create records that can be used for complaints."}
                            </p>
                        </div>
                    ) : (
                        <ul>
                            {filtered.map((r) => (
                                <li
                                    key={r.id}
                                    className="group flex items-center gap-3 border-b border-border py-3 transition-colors last:border-b-0 hover:bg-muted/30"
                                >
                                    <button
                                        type="button"
                                        onClick={() => openManage(r)}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                        aria-label={`Open complaints for ${r.product}`}
                                    >
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                                            <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">
                                                    {r.product}
                                                </p>
                                                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/70 sm:inline">
                                                    {r.id.slice(0, 8)}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                                <span>{formatDate(r.timestamp)}</span>
                                                {r.summary && (
                                                    <>
                                                        <span className="opacity-40">·</span>
                                                        <span className="truncate">{r.summary}</span>
                                                    </>
                                                )}
                                                {r.complaintCount > 0 && (
                                                    <>
                                                        <span className="opacity-40">·</span>
                                                        <span>
                                                            {r.complaintCount} complaint
                                                            {r.complaintCount === 1 ? "" : "s"}
                                                            {r.openComplaintCount > 0 && (
                                                                <>
                                                                    {" · "}
                                                                    <span className="font-medium text-destructive">
                                                                        {r.openComplaintCount} open
                                                                    </span>
                                                                </>
                                                            )}
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <StatusBadge status={r.status} />
                                        </div>
                                    </button>

                                    <div className="flex shrink-0 items-center gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => openFile(r)}
                                            aria-label={`File complaint against ${r.product}`}
                                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openManage(r)}
                                            aria-label={`Manage complaints for ${r.product}`}
                                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            {/* ── Modals ─────────────────────────────────────── */}
            <FileComplaintModal
                open={!!fileTarget}
                onClose={() => setFileTarget(null)}
                inspectionId={fileTarget?.id ?? ""}
                productName={fileTarget?.product ?? ""}
                onSubmit={submitFile}
            />

            <ManageComplaintsModal
                open={!!manageTarget}
                onClose={() => setManageTarget(null)}
                inspectionId={manageTarget?.id ?? ""}
                productName={manageTarget?.product ?? ""}
                complaints={manageComplaints}
                loading={manageLoading}
                onUpdateStatus={updateStatus}
                onFileNew={() => {
                    if (manageTarget) {
                        const r = manageTarget;
                        setManageTarget(null);
                        setFileTarget(r);
                    }
                }}
            />
        </div>
    );
}