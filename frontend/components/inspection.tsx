"use client"
import { LogoutButton } from "@/components/misc/LogoutButton";

import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Bell,
    Camera,
    CameraOff,
    Check,
    ChevronRight,
    CircleHelp,
    ClipboardCheck,
    Clock3,
    Download,
    FileCheck2,
    FileText,
    Filter,
    Flashlight,
    History as HistoryIcon,
    Image as ImageIcon,
    Info,
    LayoutDashboard,
    LoaderCircle,
    Menu,
    MoreHorizontal,
    PackageCheck,
    PanelLeft,
    Plus,
    RefreshCcw,
    Search,
    ScanLine,
    Settings2,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Upload,
    UserRound,
    UsersRound,
    X,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
    seedInspections,
    statusCopy,
    type Declaration,
    type DeclarationStatus,
    type Inspection,
    type InspectionStatus,
} from "@/lib/demo-data";
import { inspectPackage, markInspectionSaved, persistInspection } from "@/lib/mock-services";

type View = "home" | "history" | "register" | "profile" | "scan" | "processing" | "result" | "detail" | "evidence" | "report";

const navItems: Array<{ label: string; view: View; icon: LucideIcon }> = [
    { label: "Home", view: "home", icon: LayoutDashboard },
    { label: "History", view: "history", icon: HistoryIcon },
    { label: "Register", view: "register", icon: ClipboardCheck },
    { label: "Profile", view: "profile", icon: UserRound },
];

const statusStyles: Record<InspectionStatus, { dot: string; text: string; bg: string; border: string; icon: LucideIcon }> = {
    COMPLIANT: { dot: "bg-success", text: "text-success", bg: "bg-success-soft", border: "border-success/20", icon: Check },
    VIOLATION: { dot: "bg-destructive", text: "text-destructive", bg: "bg-danger-soft", border: "border-destructive/20", icon: XCircle },
    UNCERTAIN: { dot: "bg-warning", text: "text-warning", bg: "bg-warning-soft", border: "border-warning/20", icon: Info },
};

function statusLabel(status: InspectionStatus) {
    return statusCopy[status].label;
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function Button({
    children,
    className = "",
    variant = "primary",
    onClick,
    type = "button",
    disabled = false,
}: {
    children: React.ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "quiet" | "danger";
    onClick?: () => void;
    type?: "button" | "submit";
    disabled?: boolean;
}) {
    const variants = {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-card text-foreground ring-1 ring-inset ring-border hover:bg-muted",
        quiet: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    };
    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
        >
            {children}
        </button>
    );
}

function StatusBadge({ status, compact = false }: { status: InspectionStatus; compact?: boolean }) {
    const style = statusStyles[status];
    const Icon = style.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${style.bg} ${style.text} ${style.border}`}>
            <Icon className="h-3 w-3" />
            {compact ? statusCopy[status].short : statusLabel(status)}
        </span>
    );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
    return <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{children}</p>;
}

function PageContainer({ children }: { children: React.ReactNode }) {
    return (
        <main className="mx-auto max-w-6xl space-y-8 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-10">
            {children}
        </main>
    );
}

function ProductThumb({ inspection, large = false }: { inspection: Inspection; large?: boolean }) {
    const initials = inspection.product.split(" ").map((word) => word[0]).slice(0, 2).join("");
    const tone =
        inspection.status === "VIOLATION"
            ? "bg-danger-soft"
            : inspection.status === "UNCERTAIN"
            ? "bg-warning-soft"
            : "bg-brand-soft";
    return (
        <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${large ? "h-28 w-24" : "h-11 w-11"} ${tone}`}>
            {inspection.image ? (
                <img src={inspection.image} alt={`${inspection.product} package`} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-[72%] w-[66%] flex-col items-center justify-center rounded-md bg-card text-[10px] font-bold text-foreground shadow-sm">
                    <PackageCheck className="mb-1 h-4 w-4 text-brand" />
                    <span>{initials}</span>
                </div>
            )}
        </div>
    );
}

function InspectionRow({ inspection, onOpen }: { inspection: Inspection; onOpen: (inspection: Inspection) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpen(inspection)}
            className="group flex w-full items-center gap-4 border-b border-border/60 py-4 text-left last:border-0 hover:bg-muted/30 transition-colors px-1"
        >
            <ProductThumb inspection={inspection} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{inspection.product}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{inspection.dateLabel} · {inspection.summary}</p>
            </div>
            <div className="flex items-center gap-2">
                <StatusBadge status={inspection.status} compact />
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </div>
        </button>
    );
}

// ─── App Header ──────────────────────────────────────────────────────────────

function AppHeader({ title, eyebrow = "LEXMETRA", onMenu }: { title: string; eyebrow?: string; onMenu?: () => void }) {
    return (
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/98 backdrop-blur-sm md:border-b-0 md:bg-background">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        aria-label="Open navigation"
                        onClick={onMenu}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</p>
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:block">
                        <LogoutButton />
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                        <UserRound className="h-4 w-4" />
                    </div>
                </div>
            </div>
        </header>
    );
}

// ─── Desktop Sidebar ─────────────────────────────────────────────────────────

function DesktopRail({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
    return (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/60 bg-card px-3 py-6 md:flex">
            {/* Branding block */}
            <div className="mb-8 px-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ScanLine className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-bold tracking-tight text-foreground">LEXMETRA</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Legal Metrology Inspection</p>
                    </div>
                </div>
                <div className="mt-4 border-t border-border/60 pt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground/70">THE INSPECTORS · SIH 2026 · PS 26034</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-0.5">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = view === item.view;
                    return (
                        <button
                            key={item.view}
                            type="button"
                            onClick={() => onNavigate(item.view)}
                            className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                active
                                    ? "bg-primary/8 text-foreground"
                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            }`}
                        >
                            {active && (
                                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                            )}
                            <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* System status card */}
            <div className="mt-auto rounded-xl border border-border/60 bg-background p-3.5">
                <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    <p className="text-xs font-semibold text-foreground">Demo workspace</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                    Inspection engine ready · OCR active
                </p>
            </div>
        </aside>
    );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function BottomNav({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
    return (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/97 backdrop-blur-sm md:hidden">
            <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-2 pb-1">
                <NavButton label="Home" icon={LayoutDashboard} active={view === "home"} onClick={() => onNavigate("home")} />
                <NavButton label="History" icon={HistoryIcon} active={view === "history"} onClick={() => onNavigate("history")} />
                <div className="relative -top-4 flex justify-center">
                    <button
                        type="button"
                        aria-label="Start a scan"
                        onClick={() => onNavigate("scan")}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
                    >
                        <ScanLine className="h-6 w-6" />
                    </button>
                </div>
                <NavButton label="Register" icon={ClipboardCheck} active={view === "register"} onClick={() => onNavigate("register")} />
                <NavButton label="Profile" icon={UserRound} active={view === "profile"} onClick={() => onNavigate("profile")} />
            </div>
        </nav>
    );
}

function NavButton({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
            }`}
        >
            <Icon className="h-[18px] w-[18px]" />
            <span>{label}</span>
        </button>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, description, onAction }: { title: string; description: string; onAction: () => void }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <PackageCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">{title}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
            <Button className="mt-6" onClick={onAction}>
                <ScanLine className="h-4 w-4" />
                Scan product
            </Button>
        </div>
    );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: InspectionStatus }) {
    const accentClass = accent ? statusStyles[accent].text : "text-foreground";
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <SectionEyebrow>{label}</SectionEyebrow>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${accentClass}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
    );
}

// ─── Home View ───────────────────────────────────────────────────────────────

function HomeView({ inspections, onNavigate, onOpen }: { inspections: Inspection[]; onNavigate: (view: View) => void; onOpen: (inspection: Inspection) => void }) {
    const todayCount = inspections.length + 8;
    const compliant = inspections.filter((item) => item.status === "COMPLIANT").length + 6;
    const violations = inspections.filter((item) => item.status === "VIOLATION").length + 1;
    const review = inspections.filter((item) => item.status === "UNCERTAIN").length + 1;
    const compliance = Math.round((compliant / todayCount) * 100);

    return (
        <>
            <AppHeader title="Inspection dashboard" />
            <PageContainer>
                {/* Hero */}
                <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-xs font-semibold text-primary">Field Unit 04 · North Delhi</p>
                        <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground sm:text-4xl">
                            Good morning, Omkar.
                        </h2>
                        <p className="mt-1.5 text-sm text-muted-foreground">Ready for your next inspection?</p>
                    </div>
                    <Button onClick={() => onNavigate("scan")} className="shrink-0">
                        <ScanLine className="h-4 w-4" />
                        Start inspection
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </section>

                {/* Metrics */}
                <section className="rounded-2xl border border-border/60 bg-card">
                    <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
                        {[
                            { label: "Scanned", value: todayCount, sub: "Today", accent: undefined },
                            { label: "Compliant", value: compliant, sub: `${compliance}%`, accent: "COMPLIANT" as InspectionStatus },
                            { label: "Violations", value: violations, sub: "Attention", accent: "VIOLATION" as InspectionStatus },
                            { label: "Review", value: review, sub: "Needs review", accent: "UNCERTAIN" as InspectionStatus },
                        ].map((m) => (
                            <div key={m.label} className="p-5">
                                <MetricCard {...m} />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Next action + register health */}
                <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
                    {/* Next action card */}
                    <button
                        type="button"
                        onClick={() => onNavigate("scan")}
                        className="group relative overflow-hidden rounded-2xl bg-primary p-6 text-left text-primary-foreground transition-transform hover:-translate-y-0.5 sm:p-8"
                    >
                        <div className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-xl border border-primary-foreground/15 bg-primary-foreground/10">
                            <ScanLine className="h-5 w-5 opacity-70" />
                        </div>
                        <SectionEyebrow>
                            <span className="text-primary-foreground/50">Next action</span>
                        </SectionEyebrow>
                        <h3 className="mt-10 max-w-xs text-2xl font-semibold tracking-tight">Scan a product label</h3>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-primary-foreground/65">
                            Capture declarations, validate the package, and create an evidence-backed inspection record.
                        </p>
                        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
                            Open scanner
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </button>

                    {/* Register health */}
                    <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
                        <div className="flex items-start justify-between">
                            <div>
                                <SectionEyebrow>Register health</SectionEyebrow>
                                <p className="mt-3 text-3xl font-semibold tracking-tight">92%</p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
                                <BadgeCheck className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full w-[92%] rounded-full bg-success/70" />
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">Most recent checks are ready for review.</p>
                    </div>
                </section>

                {/* Recent inspections */}
                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <SectionEyebrow>Latest activity</SectionEyebrow>
                            <h3 className="mt-1 text-xl font-semibold tracking-tight">Recent inspections</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate("history")}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80"
                        >
                            View all
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card px-4">
                        {inspections.slice(0, 4).map((inspection) => (
                            <InspectionRow key={inspection.id} inspection={inspection} onOpen={onOpen} />
                        ))}
                    </div>
                </section>
            </PageContainer>
        </>
    );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({ search, setSearch, filter, setFilter }: { search: string; setSearch: (value: string) => void; filter: "ALL" | InspectionStatus; setFilter: (value: "ALL" | InspectionStatus) => void }) {
    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products or inspection IDs…"
                    className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {(["ALL", "COMPLIANT", "VIOLATION", "UNCERTAIN"] as const).map((item) => (
                    <button
                        type="button"
                        key={item}
                        onClick={() => setFilter(item)}
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            filter === item
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {item === "ALL" ? "All" : statusLabel(item)}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── List View (History / Register) ──────────────────────────────────────────

function ListView({ kind, inspections, onOpen, onNavigate }: { kind: "history" | "register"; inspections: Inspection[]; onOpen: (inspection: Inspection) => void; onNavigate: (view: View) => void }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"ALL" | InspectionStatus>("ALL");
    const filtered = useMemo(
        () =>
            inspections.filter(
                (item) =>
                    (kind === "history" || item.saved) &&
                    (filter === "ALL" || item.status === filter) &&
                    `${item.product} ${item.id} ${item.manufacturer}`.toLowerCase().includes(search.toLowerCase())
            ),
        [filter, inspections, kind, search]
    );
    const title = kind === "history" ? "Inspection history" : "Compliance register";
    const subtitle =
        kind === "history" ? "Every package inspection, in one place." : "Products you have explicitly verified.";

    return (
        <>
            <AppHeader title={title} />
            <PageContainer>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <SectionEyebrow>{kind === "history" ? "Audit trail" : "Statutory records"}</SectionEyebrow>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
                        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                    <div className="shrink-0 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">Showing </span>
                        <strong>{filtered.length}</strong>
                        <span className="text-muted-foreground"> records</span>
                    </div>
                </div>
                <FilterBar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} />
                {filtered.length ? (
                    <div className="rounded-2xl border border-border/60 bg-card px-4">
                        {filtered.map((inspection) => (
                            <InspectionRow key={inspection.id} inspection={inspection} onOpen={onOpen} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title={search || filter !== "ALL" ? "No matching records" : kind === "history" ? "No inspections yet" : "Your register is empty"}
                        description={
                            search || filter !== "ALL"
                                ? "Try a different search or filter."
                                : kind === "history"
                                ? "Scan your first product to start building your inspection history."
                                : "Products you verify and save will appear here."
                        }
                        onAction={() => onNavigate("scan")}
                    />
                )}
            </PageContainer>
        </>
    );
}

// ─── Scan View ────────────────────────────────────────────────────────────────

function ScanView({ onImage, onBack }: { onImage: (image?: string) => void; onBack: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState(false);

    useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

    async function startCamera() {
        if (!navigator.mediaDevices?.getUserMedia) { setCameraError(true); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setCameraActive(true);
        } catch {
            setCameraError(true);
        }
    }

    function capture() {
        if (!cameraActive || !videoRef.current) { onImage(); return; }
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 800;
        canvas.height = video.videoHeight || 1000;
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        onImage(canvas.toDataURL("image/jpeg", 0.82));
    }

    function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onImage(typeof reader.result === "string" ? reader.result : undefined);
        reader.readAsDataURL(file);
    }

    return (
        <div className="min-h-screen bg-primary text-primary-foreground">
            <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-5 sm:px-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-colors"
                        aria-label="Back"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary-foreground/50">Live capture</p>
                        <h1 className="mt-0.5 text-base font-semibold">Scan product</h1>
                    </div>
                    <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-colors"
                        aria-label="Toggle flash"
                    >
                        <Flashlight className="h-5 w-5" />
                    </button>
                </div>

                {/* Viewfinder */}
                <div className="flex flex-1 flex-col justify-center py-8">
                    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl border border-primary-foreground/15 bg-primary-foreground/5">
                        <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative h-[78%] w-[78%]">
                                {/* Corner brackets */}
                                <span className="absolute -left-px -top-px h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-primary-foreground" />
                                <span className="absolute -right-px -top-px h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-primary-foreground" />
                                <span className="absolute -bottom-px -left-px h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-primary-foreground" />
                                <span className="absolute -bottom-px -right-px h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-primary-foreground" />
                                {cameraActive && (
                                    <div className="scan-line absolute inset-x-0 top-1/2 h-px bg-primary-foreground/80 shadow-[0_0_12px_2px] shadow-primary-foreground/40" />
                                )}
                            </div>
                        </div>
                        {!cameraActive && (
                            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 text-center backdrop-blur">
                                <Camera className="mx-auto h-6 w-6 text-primary-foreground/60" />
                                <p className="mt-2 text-sm font-semibold">Camera preview</p>
                                <p className="mt-1 text-xs leading-5 text-primary-foreground/55">
                                    Position the label inside the frame.
                                </p>
                                <Button
                                    variant="secondary"
                                    className="mt-4 bg-primary-foreground text-primary text-xs"
                                    onClick={startCamera}
                                >
                                    <Camera className="h-3.5 w-3.5" />
                                    Enable camera
                                </Button>
                            </div>
                        )}
                    </div>
                    <p className="mx-auto mt-4 max-w-xs text-center text-xs text-primary-foreground/50">
                        Use a clear, well-lit image. Demo capture is available if camera is unavailable.
                    </p>
                    {cameraError && (
                        <div className="mx-auto mt-3 flex items-center gap-2 rounded-lg bg-warning/20 px-3 py-2 text-xs text-warning">
                            <CameraOff className="h-4 w-4 shrink-0" />
                            Camera unavailable — use gallery or demo capture.
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-end justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="flex w-20 flex-col items-center gap-2 text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground/90 transition-colors"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-foreground/10">
                            <ImageIcon className="h-5 w-5" />
                        </span>
                        Gallery
                    </button>

                    <button
                        type="button"
                        onClick={capture}
                        aria-label="Capture inspection image"
                        className="flex h-18 w-18 items-center justify-center rounded-full border-[5px] border-primary-foreground/20 bg-primary-foreground text-primary transition-transform active:scale-95"
                        style={{ height: 72, width: 72 }}
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/20">
                            <Camera className="h-5 w-5" />
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onImage()}
                        className="flex w-20 flex-col items-center gap-2 text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground/90 transition-colors"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-foreground/10">
                            <Sparkles className="h-5 w-5" />
                        </span>
                        Demo case
                    </button>
                </div>

                <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}

// ─── Processing View ──────────────────────────────────────────────────────────

function ProcessingView({ onComplete }: { onComplete: () => void }) {
    const steps = [
        "Image received",
        "Detecting package label",
        "Extracting declarations",
        "Checking Legal Metrology rules",
        "Preparing compliance report",
    ];
    const [active, setActive] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => setActive((value) => Math.min(value + 1, steps.length)), 650);
        const done = window.setTimeout(onComplete, 3500);
        return () => { window.clearInterval(interval); window.clearTimeout(done); };
    }, [onComplete, steps.length]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <LoaderCircle className="breathe h-8 w-8" />
                </div>
                <div className="mt-6 text-center">
                    <SectionEyebrow>Inspection pipeline</SectionEyebrow>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">Analyzing package</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Extracting evidence and checking each declaration against the demo rule set.
                    </p>
                </div>
                <div className="mt-8 space-y-2">
                    {steps.map((step, index) => (
                        <div
                            key={step}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                index < active
                                    ? "border-success/20 bg-success-soft"
                                    : index === active
                                    ? "border-brand/25 bg-brand-soft"
                                    : "border-border bg-card"
                            }`}
                        >
                            {index < active ? (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                                    <Check className="h-3 w-3" />
                                </span>
                            ) : index === active ? (
                                <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-brand" />
                            ) : (
                                <span className="h-5 w-5 shrink-0 rounded-full border border-border" />
                            )}
                            <span className={`text-sm font-medium ${index <= active ? "text-foreground" : "text-muted-foreground"}`}>
                                {step}
                            </span>
                            {index === active && (
                                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-brand">Active</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Declaration Row ──────────────────────────────────────────────────────────

function DeclarationRow({ declaration }: { declaration: Declaration }) {
    const statusMap: Record<DeclarationStatus, { label: string; className: string; icon: LucideIcon }> = {
        VERIFIED: { label: "Verified", className: "text-success", icon: Check },
        MISSING: { label: "Missing", className: "text-destructive", icon: XCircle },
        REVIEW: { label: "Review", className: "text-warning", icon: Info },
    };
    const item = statusMap[declaration.status];
    const Icon = item.icon;
    return (
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border/60 py-3.5 last:border-0 sm:grid-cols-[1.1fr_1fr_auto]">
            <div>
                <p className="text-sm font-semibold">{declaration.field}</p>
                <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{declaration.value}</p>
            </div>
            <p className="hidden text-sm text-muted-foreground sm:block">{declaration.value}</p>
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${item.className}`}>
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                <span className="hidden text-[10px] text-muted-foreground sm:inline">{declaration.confidence}%</span>
            </div>
        </div>
    );
}

// ─── Result View ──────────────────────────────────────────────────────────────

function ResultView({ inspection, onSave, onOpenEvidence, onOpenReport, onNew }: { inspection: Inspection; onSave: () => void; onOpenEvidence: () => void; onOpenReport: () => void; onNew: () => void }) {
    const style = statusStyles[inspection.status];
    const verified = inspection.declarations.filter((item) => item.status === "VERIFIED").length;

    return (
        <>
            <AppHeader title="Inspection result" />
            <main className="mx-auto max-w-5xl space-y-5 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-10">
                <button
                    type="button"
                    onClick={onNew}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    New inspection
                </button>

                {/* Decision card */}
                <section className={`overflow-hidden rounded-2xl border ${style.border} ${style.bg}`}>
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                        <div>
                            <StatusBadge status={inspection.status} />
                            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                                {inspection.status === "COMPLIANT"
                                    ? "Compliant"
                                    : inspection.status === "VIOLATION"
                                    ? "Compliance issue found"
                                    : "Needs review"}
                            </h2>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                                {inspection.status === "COMPLIANT"
                                    ? "Required declarations were detected and validated against the demo rule set."
                                    : inspection.status === "VIOLATION"
                                    ? "Some required information was not detected or needs an officer review."
                                    : "Some information could not be reliably verified from the image."}
                            </p>
                        </div>
                        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full bg-card ring-1 ring-border/60">
                            <span className={`text-2xl font-semibold ${style.text}`}>{inspection.score}%</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Score</span>
                        </div>
                    </div>
                    {/* Metadata strip */}
                    <div className="grid grid-cols-2 gap-0 border-t border-border/40 bg-card/60 sm:grid-cols-4">
                        {[
                            { label: "Product", value: inspection.product },
                            { label: "Inspection", value: `#${inspection.id}` },
                            { label: "Checked", value: `${verified} / 8` },
                            { label: "Time", value: inspection.dateLabel },
                        ].map((meta, i) => (
                            <div key={meta.label} className={`p-4 ${i < 3 ? "border-b border-border/40 sm:border-b-0 sm:border-r sm:border-border/40" : ""}`}>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{meta.label}</p>
                                <p className="mt-1 text-sm font-semibold">{meta.value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Declarations */}
                <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7">
                    <div className="flex items-end justify-between">
                        <div>
                            <SectionEyebrow>Declarations</SectionEyebrow>
                            <h3 className="mt-1 text-lg font-semibold tracking-tight">Extracted information</h3>
                        </div>
                        <span className="text-sm text-muted-foreground">{verified}/8 verified</span>
                    </div>
                    <div className="mt-4">
                        {inspection.declarations.map((declaration) => (
                            <DeclarationRow key={declaration.field} declaration={declaration} />
                        ))}
                    </div>
                </section>

                {/* Issues */}
                {inspection.status !== "COMPLIANT" && (
                    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7">
                        <div className="flex items-center justify-between">
                            <div>
                                <SectionEyebrow>Rules checked</SectionEyebrow>
                                <h3 className="mt-1 text-lg font-semibold tracking-tight">Issues found</h3>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {inspection.declarations
                                .filter((item) => item.status !== "VERIFIED")
                                .map((item) => (
                                    <div key={item.field} className={`flex items-start gap-3 rounded-xl p-4 ${item.status === "MISSING" ? "bg-danger-soft border border-destructive/10" : "bg-warning-soft border border-warning/10"}`}>
                                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.status === "MISSING" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                                            {item.status === "MISSING" ? <XCircle className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">{item.field}</p>
                                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                                {item.status === "MISSING"
                                                    ? "Required declaration was not detected in the captured label."
                                                    : "Evidence is ambiguous and requires human review."}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </section>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                        onClick={onSave}
                        variant={inspection.saved ? "secondary" : "primary"}
                        disabled={inspection.saved}
                        className="sm:flex-1"
                    >
                        <BadgeCheck className="h-4 w-4" />
                        {inspection.saved ? "Saved to register" : "Save inspection"}
                    </Button>
                    <Button onClick={onOpenEvidence} variant="secondary" className="sm:flex-1">
                        <ScanLine className="h-4 w-4" />
                        View evidence
                    </Button>
                    <Button onClick={onOpenReport} variant="secondary" className="sm:flex-1">
                        <FileText className="h-4 w-4" />
                        Report preview
                    </Button>
                </div>
            </main>
        </>
    );
}

// ─── Evidence View ────────────────────────────────────────────────────────────

function EvidenceView({ inspection, onBack }: { inspection: Inspection; onBack: () => void }) {
    const [selected, setSelected] = useState(inspection.evidence[0]);

    return (
        <>
            <AppHeader title="Evidence viewer" />
            <main className="mx-auto max-w-5xl space-y-5 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to result
                </button>

                <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
                    {/* Image */}
                    <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <SectionEyebrow>Original capture</SectionEyebrow>
                                <h2 className="mt-1 text-lg font-semibold tracking-tight">Detected regions</h2>
                            </div>
                            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                                {inspection.evidence.length} markers
                            </span>
                        </div>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                            {inspection.image ? (
                                <img src={inspection.image} alt="Uploaded package evidence" className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <ProductThumb inspection={inspection} large />
                                </div>
                            )}
                            {inspection.evidence.map((region) => (
                                <button
                                    type="button"
                                    key={region.label}
                                    onClick={() => setSelected(region)}
                                    style={{
                                        top: `${region.top}%`,
                                        left: `${region.left}%`,
                                        width: `${region.width}%`,
                                        height: `${region.height}%`,
                                    }}
                                    className={`absolute rounded-md border-2 text-left transition-all ${
                                        selected?.label === region.label
                                            ? "border-brand bg-brand/20"
                                            : "border-brand/60 bg-brand/10 hover:bg-brand/20"
                                    }`}
                                >
                                    <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-brand px-1.5 py-0.5 text-[9px] font-bold text-brand-foreground">
                                        {region.label} · {region.confidence}%
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Detail panel */}
                    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
                        <SectionEyebrow>Evidence detail</SectionEyebrow>
                        {selected ? (
                            <>
                                <h2 className="mt-2 text-xl font-semibold tracking-tight">{selected.label}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Detected from package image</p>
                                <div className="mt-6 rounded-xl bg-muted p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Detected text</p>
                                    <p className="mt-2 text-base font-semibold">{selected.value}</p>
                                </div>
                                <div className="mt-4 flex items-center justify-between border-b border-border/60 pb-4">
                                    <span className="text-sm text-muted-foreground">Confidence</span>
                                    <span className="text-sm font-bold text-success">{selected.confidence}%</span>
                                </div>
                                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                                    This region is linked to the extracted declaration in the inspection record.
                                </p>
                            </>
                        ) : (
                            <div className="mt-8 rounded-xl bg-warning-soft p-5 text-center">
                                <Info className="mx-auto h-5 w-5 text-warning" />
                                <p className="mt-2 text-sm font-semibold">Evidence unavailable</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    No reliable region was detected for this inspection.
                                </p>
                            </div>
                        )}
                    </section>
                </div>

                {inspection.status === "UNCERTAIN" && (
                    <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm">
                        <Info className="h-4 w-4 shrink-0 text-warning" />
                        <p>
                            <strong>Human review recommended.</strong> The image does not provide sufficient evidence for a final compliance decision.
                        </p>
                    </div>
                )}
            </main>
        </>
    );
}

// ─── Report View ──────────────────────────────────────────────────────────────

function ReportView({ inspection, onBack }: { inspection: Inspection; onBack: () => void }) {
    const [downloaded, setDownloaded] = useState(false);

    return (
        <>
            <AppHeader title="Report preview" />
            <main className="mx-auto max-w-4xl space-y-5 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-10">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to result
                    </button>
                    <Button variant="secondary" onClick={() => setDownloaded(true)}>
                        <Download className="h-4 w-4" />
                        {downloaded ? "Report ready" : "Download report"}
                    </Button>
                </div>

                <article className="rounded-2xl border border-border/60 bg-card p-6 sm:p-10">
                    {/* Report header */}
                    <div className="flex flex-col justify-between gap-5 border-b border-border/60 pb-7 sm:flex-row sm:items-start">
                        <div>
                            <div className="flex items-center gap-2 text-primary">
                                <FileCheck2 className="h-4 w-4" />
                                <span className="text-[10px] font-bold uppercase tracking-[.18em]">Legal metrology inspection</span>
                            </div>
                            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Inspection report</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                THE INSPECTORS · SIH 2026 · PS 26034
                            </p>
                        </div>
                        <StatusBadge status={inspection.status} />
                    </div>

                    {/* Metadata */}
                    <div className="grid gap-5 border-b border-border/60 py-7 sm:grid-cols-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product</p>
                            <p className="mt-2 text-sm font-semibold">{inspection.product}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{inspection.manufacturer}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inspection ID</p>
                            <p className="mt-2 text-sm font-semibold">#{inspection.id}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(inspection.timestamp)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Final score</p>
                            <p className="mt-2 text-sm font-semibold">
                                {inspection.score}% · {inspection.declarations.filter((item) => item.status === "VERIFIED").length}/8 verified
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Demo rule set</p>
                        </div>
                    </div>

                    {/* Declarations table */}
                    <div className="py-7">
                        <h3 className="text-sm font-semibold">Extracted declarations</h3>
                        <div className="mt-4 divide-y divide-border/60">
                            {inspection.declarations.map((item) => (
                                <div key={item.field} className="flex items-center justify-between py-3 text-sm">
                                    <span className="text-muted-foreground">{item.field}</span>
                                    <span
                                        className={
                                            item.status === "VERIFIED"
                                                ? "font-semibold text-success"
                                                : item.status === "MISSING"
                                                ? "font-semibold text-destructive"
                                                : "font-semibold text-warning"
                                        }
                                    >
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recommendation */}
                    <div className="rounded-xl bg-muted p-5">
                        <SectionEyebrow>Reviewer recommendation</SectionEyebrow>
                        <p className="mt-2 text-sm leading-6">
                            {inspection.status === "COMPLIANT"
                                ? "Record may be added to the compliance register after officer confirmation."
                                : inspection.status === "VIOLATION"
                                ? "Issue a review notice for missing or incomplete declarations before verification."
                                : "Review the original evidence and request a clearer package image before deciding."}
                        </p>
                    </div>
                </article>
            </main>
        </>
    );
}

// ─── Profile View ─────────────────────────────────────────────────────────────

function ProfileView() {
    return (
        <>
            <AppHeader title="Inspector profile" />
            <main className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-10">
                {/* Identity card */}
                <section className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-7">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <UserRound className="h-6 w-6" />
                    </div>
                    <div>
                        <SectionEyebrow>Inspector</SectionEyebrow>
                        <h2 className="mt-1 text-lg font-semibold">Omkar Kulkarni</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">ID · LM-DL-8812</p>
                    </div>
                    <BadgeCheck className="ml-auto h-5 w-5 text-success" />
                </section>

                {/* System status */}
                <section className="rounded-2xl border border-border/60 bg-card">
                    <div className="border-b border-border/60 p-5">
                        <SectionEyebrow>Workspace</SectionEyebrow>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight">System status</h3>
                    </div>
                    <div className="divide-y divide-border/60">
                        {[
                            [ScanLine, "Inspection engine", "Ready for demo checks"],
                            [Sparkles, "OCR extraction", "Mock service · active"],
                            [ShieldCheck, "Evidence storage", "Local device only"],
                        ].map(([Icon, label, value]) => {
                            const ItemIcon = Icon as LucideIcon;
                            return (
                                <div key={String(label)} className="flex items-center gap-3 p-5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary">
                                        <ItemIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">{String(label)}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{String(value)}</p>
                                    </div>
                                    <span className="h-2 w-2 rounded-full bg-success" />
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Settings */}
                <section className="rounded-2xl border border-border/60 bg-card">
                    <div className="border-b border-border/60 p-5">
                        <SectionEyebrow>Preferences</SectionEyebrow>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight">Settings</h3>
                    </div>
                    {[
                        [Bell, "Notifications", "Inspection reminders"],
                        [Settings2, "Language", "English (India)"],
                        [CircleHelp, "Help & feedback", "Product guidance"],
                    ].map(([Icon, label, value]) => {
                        const ItemIcon = Icon as LucideIcon;
                        return (
                            <button
                                type="button"
                                key={String(label)}
                                className="flex w-full items-center gap-3 border-b border-border/60 p-5 text-left last:border-0 hover:bg-muted/40 transition-colors"
                            >
                                <ItemIcon className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{String(label)}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{String(value)}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                            </button>
                        );
                    })}
                </section>
            </main>
        </>
    );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function InspectionApp() {
    const [view, setView] = useState<View>("home");
    const [inspections, setInspections] = useState<Inspection[]>(seedInspections);
    const [selected, setSelected] = useState<Inspection | undefined>(undefined);
    const [pendingImage, setPendingImage] = useState<string | undefined>(undefined);
    const [toast, setToast] = useState<string | undefined>(undefined);

    useEffect(() => {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("the-inspectors-inspections") : null;
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as Inspection[];
                if (Array.isArray(parsed) && parsed.length)
                    setInspections([...parsed, ...seedInspections.filter((seed) => !parsed.some((item) => item.id === seed.id))]);
            } catch { /* fallback to fixtures */ }
        }
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => setToast(undefined), 2600);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    function go(nextView: View) {
        setView(nextView);
        if (!["result", "detail", "evidence", "report"].includes(nextView)) setSelected(undefined);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleOpen(inspection: Inspection) {
        setSelected(inspection);
        setView("detail");
    }

    function startImage(image?: string) {
        setPendingImage(image);
        setView("processing");
    }

    async function finishProcessing() {
        const result = await inspectPackage(pendingImage);
        setSelected(result);
        setInspections((current) => [result, ...current]);
        setView("result");
    }

    function saveCurrent() {
        if (!selected) return;
        const saved = { ...selected, saved: true };
        persistInspection(saved);
        setSelected(saved);
        setInspections((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setToast("Inspection saved to your local register");
    }

    function saveAndRegister() {
        if (!selected) return;
        const saved = { ...selected, saved: true };
        markInspectionSaved(saved.id);
        setSelected(saved);
        setInspections((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setToast("Added to Compliance Register");
    }

    const content =
        view === "home" ? <HomeView inspections={inspections} onNavigate={go} onOpen={handleOpen} /> :
        view === "history" ? <ListView kind="history" inspections={inspections} onOpen={handleOpen} onNavigate={go} /> :
        view === "register" ? <ListView kind="register" inspections={inspections} onOpen={handleOpen} onNavigate={go} /> :
        view === "profile" ? <ProfileView /> :
        view === "scan" ? <ScanView onImage={startImage} onBack={() => go("home")} /> :
        view === "processing" ? <ProcessingView onComplete={finishProcessing} /> :
        selected && (view === "result" || view === "detail") ? <ResultView inspection={selected} onSave={saveAndRegister} onOpenEvidence={() => go("evidence")} onOpenReport={() => go("report")} onNew={() => go("scan")} /> :
        selected && view === "evidence" ? <EvidenceView inspection={selected} onBack={() => go("result")} /> :
        selected && view === "report" ? <ReportView inspection={selected} onBack={() => go("result")} /> :
        <HomeView inspections={inspections} onNavigate={go} onOpen={handleOpen} />;

    const inFocusedFlow = ["scan", "processing"].includes(view);

    return (
        <div className="min-h-screen bg-background text-foreground">
            {!inFocusedFlow && <DesktopRail view={view} onNavigate={go} />}
            {!inFocusedFlow && <div className="md:pl-60">{content}</div>}
            {inFocusedFlow && content}
            {!inFocusedFlow && <BottomNav view={view} onNavigate={go} />}
            {toast && (
                <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-lg md:bottom-8">
                    <Check className="h-4 w-4 text-success" />
                    {toast}
                </div>
            )}
        </div>
    );
}