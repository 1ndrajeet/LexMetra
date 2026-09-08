// app/page.tsx
"use client"

import { LogoutButton } from "@/components/misc/LogoutButton"
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  History as HistoryIcon,
  Info,
  LayoutDashboard,
  PackageCheck,
  ScanLine,
  UserRound,
  XCircle,
} from "lucide-react"
import { useState } from "react"

import {
  seedInspections,
  statusCopy,
  type Inspection,
  type InspectionStatus,
} from "@/lib/demo-data"

type View = "home" | "history" | "register" | "profile" | "scan" | "processing" | "result" | "detail" | "evidence" | "report"

const statusStyles: Record<InspectionStatus, { dot: string; text: string; bg: string; border: string; icon: any }> = {
  COMPLIANT: { dot: "bg-success", text: "text-success", bg: "bg-success-soft", border: "border-success/20", icon: Check },
  VIOLATION: { dot: "bg-destructive", text: "text-destructive", bg: "bg-danger-soft", border: "border-destructive/20", icon: XCircle },
  UNCERTAIN: { dot: "bg-warning", text: "text-warning", bg: "bg-warning-soft", border: "border-warning/20", icon: Info },
}

function statusLabel(status: InspectionStatus) {
  return statusCopy[status].label
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
  children: React.ReactNode
  className?: string
  variant?: "primary" | "secondary" | "quiet" | "danger"
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-card text-foreground ring-1 ring-inset ring-border hover:bg-muted",
    quiet: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status, compact = false }: { status: InspectionStatus; compact?: boolean }) {
  const style = statusStyles[status]
  const Icon = style.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${style.bg} ${style.text} ${style.border}`}
    >
      <Icon className="h-3 w-3" />
      {compact ? statusCopy[status].short : statusLabel(status)}
    </span>
  )
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{children}</p>
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    // REMOVED: pb-28 - layout handles scrolling
    // REMOVED: pt-6 - let layout handle padding
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  )
}

function ProductThumb({ inspection, large = false }: { inspection: Inspection; large?: boolean }) {
  const initials = inspection.product
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
  const tone =
    inspection.status === "VIOLATION"
      ? "bg-danger-soft"
      : inspection.status === "UNCERTAIN"
        ? "bg-warning-soft"
        : "bg-brand-soft"
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${large ? "h-28 w-24" : "h-11 w-11"} ${tone}`}
    >
      {inspection.image ? (
        <img src={inspection.image} alt={`${inspection.product} package`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-[72%] w-[66%] flex-col items-center justify-center rounded-md bg-card text-[10px] font-bold text-foreground shadow-sm">
          <PackageCheck className="mb-1 h-4 w-4 text-brand" />
          <span>{initials}</span>
        </div>
      )}
    </div>
  )
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
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: InspectionStatus }) {
  const accentClass = accent ? statusStyles[accent].text : "text-foreground"
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <SectionEyebrow>{label}</SectionEyebrow>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${accentClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

// ─── Home View ───────────────────────────────────────────────────────────────

function HomeView({
  inspections,
  onNavigate,
  onOpen,
}: {
  inspections: Inspection[]
  onNavigate: (view: View) => void
  onOpen: (inspection: Inspection) => void
}) {
  const todayCount = inspections.length + 8
  const compliant = inspections.filter((item) => item.status === "COMPLIANT").length + 6
  const violations = inspections.filter((item) => item.status === "VIOLATION").length + 1
  const review = inspections.filter((item) => item.status === "UNCERTAIN").length + 1
  const compliance = Math.round((compliant / todayCount) * 100)

  return (
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
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [inspections] = useState<Inspection[]>(seedInspections)
  const [view, setView] = useState<View>("home")

  function go(nextView: View) {
    setView(nextView)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleOpen(inspection: Inspection) {
    console.log("Open inspection:", inspection.id)
  }

  return <HomeView inspections={inspections} onNavigate={go} onOpen={handleOpen} />
}