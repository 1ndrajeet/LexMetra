"use client"

import {
  ArrowRight,
  ChevronRight,
  Info,
  Check,
  Loader2,
  MapPin,
  Package,
  ScanLine,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import type { HomeApiResponse } from "@/app/api/(dashboard)/home/route"

type UiStatus = "COMPLIANT" | "VIOLATION" | "UNCERTAIN"

const statusStyles: Record<
  UiStatus,
  { dot: string; text: string; bg: string; border: string; icon: any }
> = {
  COMPLIANT: {
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success-soft",
    border: "border-success/20",
    icon: Check,
  },
  VIOLATION: {
    dot: "bg-destructive",
    text: "text-destructive",
    bg: "bg-danger-soft",
    border: "border-destructive/20",
    icon: XCircle,
  },
  UNCERTAIN: {
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning-soft",
    border: "border-warning/20",
    icon: Info,
  },
}

const statusCopy: Record<UiStatus, { label: string; short: string }> = {
  COMPLIANT: { label: "Compliant", short: "OK" },
  VIOLATION: { label: "Violation", short: "Fail" },
  UNCERTAIN: { label: "Uncertain", short: "Review" },
}

// ─── Location hook (UNCHANGED) ──────────────────────────────────────────────

type LocationState =
  | { status: "idle" }
  | { status: "prompting" }
  | { status: "granted"; label: string }
  | { status: "denied"; reason: string }
  | { status: "unavailable"; reason: string }

const LOC_CACHE_KEY = "lexmetra.location.v1"
const LOC_CACHE_TTL = 30 * 60 * 1000

function readLocCache(): { label: string; at: number } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LOC_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { label: string; at: number }
    if (Date.now() - parsed.at > LOC_CACHE_TTL) return null
    return parsed
  } catch {
    return null
  }
}

function writeLocCache(label: string) {
  try {
    window.localStorage.setItem(
      LOC_CACHE_KEY,
      JSON.stringify({ label, at: Date.now() }),
    )
  } catch {}
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    )
    if (!res.ok) throw new Error("geocode failed")
    const data = (await res.json()) as { address?: Record<string, string> }
    const a = data.address ?? {}
    const city =
      a.city || a.town || a.village || a.suburb || a.county || a.state_district
    const state = a.state
    if (city && state) return `${city}, ${state}`
    if (city) return city
    if (state) return state
    if (a.country) return a.country
    return "Current location"
  } catch {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz.split("/").pop()?.replace(/_/g, " ") ?? "Current location"
  }
}

function useLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" })

  useEffect(() => {
    const cached = readLocCache()
    if (cached) setState({ status: "granted", label: cached.label })
  }, [])

  async function request() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable", reason: "Geolocation not supported" })
      return
    }
    const cached = readLocCache()
    if (cached) {
      setState({ status: "granted", label: cached.label })
      return
    }
    setState({ status: "prompting" })
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 5 * 60 * 1000,
        })
      })
      const label = await reverseGeocode(
        pos.coords.latitude,
        pos.coords.longitude,
      )
      writeLocCache(label)
      setState({ status: "granted", label })
    } catch (err) {
      const e = err as GeolocationPositionError
      if (e?.code === 1)
        setState({ status: "denied", reason: "Permission denied" })
      else if (e?.code === 2)
        setState({ status: "unavailable", reason: "Position unavailable" })
      else if (e?.code === 3)
        setState({ status: "unavailable", reason: "Timed out" })
      else
        setState({
          status: "unavailable",
          reason: "Could not determine location",
        })
    }
  }

  return { state, request }
}

// ─── Primitives ─────────────────────────────────────────────────────────────

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
    secondary:
      "bg-card text-foreground ring-1 ring-inset ring-border hover:bg-muted",
    quiet: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  )
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: UiStatus
  compact?: boolean
}) {
  const style = statusStyles[status]
  const Icon = style.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${style.bg} ${style.text} ${style.border}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {compact ? statusCopy[status].short : statusCopy[status].label}
    </span>
  )
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

function uiStatusFromVerdict(verdict: string): UiStatus {
  if (verdict === "PASS") return "COMPLIANT"
  if (verdict === "FAIL") return "VIOLATION"
  return "UNCERTAIN"
}

// ─── LocationLine — quiet metadata ──────────────────────────────────────────

function LocationLine() {
  const { state, request } = useLocation()

  if (state.status === "granted") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {state.label}
      </span>
    )
  }

  if (state.status === "prompting") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Locating…
      </span>
    )
  }

  const label =
    state.status === "denied"
      ? "Location blocked"
      : state.status === "unavailable"
        ? "Location unavailable"
        : "Set location"

  return (
    <button
      type="button"
      onClick={request}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
    >
      <MapPin className="h-3 w-3" />
      {label}
    </button>
  )
}

// ─── Thumbnail ──────────────────────────────────────────────────────────────

function ProductThumb() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40">
      <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
    </div>
  )
}

// ─── InspectionRow — flat, dense ────────────────────────────────────────────

function InspectionRow({
  inspection,
  onOpen,
}: {
  inspection: HomeApiResponse["recentInspections"][number]
  onOpen: (id: string) => void
}) {
  const status = uiStatusFromVerdict(inspection.verdict)
  return (
    <button
      type="button"
      onClick={() => onOpen(inspection.id)}
      className="group flex w-full items-center gap-3 border-b border-border/60 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30"
    >
      <ProductThumb />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {inspection.productName ?? "Untitled product"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relativeTime(inspection.createdAt)}
          <span className="mx-1.5 opacity-40">·</span>
          {inspection.imageCount} image{inspection.imageCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusBadge status={status} compact />
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

// ─── Home View ──────────────────────────────────────────────────────────────

function HomeView({
  data,
  loading,
  error,
  onNavigate,
  onOpen,
  onRetry,
}: {
  data: HomeApiResponse | null
  loading: boolean
  error: string | null
  onNavigate: (path: string) => void
  onOpen: (id: string) => void
  onRetry: () => void
}) {
  const metrics = data?.metrics ?? {
    scannedToday: 0,
    compliant: 0,
    violations: 0,
    review: 0,
    compliancePct: 0,
  }
  const registerHealth = data?.registerHealth ?? { pct: 0, readyForReview: 0 }
  const recent = data?.recentInspections ?? []

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  // Metric cells — flat, no cards, only status colors on values
  const metricCells = [
    {
      label: "Scanned",
      value: metrics.scannedToday,
      sub: "Today",
      accent: undefined as UiStatus | undefined,
      href: "/history",
    },
    {
      label: "Compliant",
      value: metrics.compliant,
      sub: `${metrics.compliancePct}% rate`,
      accent: "COMPLIANT" as UiStatus,
      href: "/history?verdict=PASS",
    },
    {
      label: "Violations",
      value: metrics.violations,
      sub: "Attention",
      accent: "VIOLATION" as UiStatus,
      href: "/history?verdict=FAIL",
    },
    {
      label: "Review",
      value: metrics.review,
      sub: "Needs review",
      accent: "UNCERTAIN" as UiStatus,
      href: "/history?verdict=UNCERTAIN",
    },
  ]

  return (
    <PageContainer>
      {/* ── Header ─────────────────────────────────────── */}
      <header className="pt-6 pb-5 sm:pt-8 sm:pb-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span>Field unit 04</span>
          <span className="opacity-40">·</span>
          <LocationLine />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-[1.7rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
              {greeting}, Omkar.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ready for your next inspection?
            </p>
          </div>

          <Button
            onClick={() => onNavigate("/scan")}
            className="w-full shrink-0 sm:w-auto"
          >
            <ScanLine className="h-4 w-4" />
            Start inspection
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Error notice ───────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 border-l-2 border-destructive bg-danger-soft/60 px-3 py-2 text-sm text-destructive">
          <span className="truncate">Could not load dashboard.</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Metrics strip ──────────────────────────────── */}
      <section className="border-y border-border/60">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {metricCells.map((m, i) => {
            const isTopRow = i < 2
            const isLeftCol = i % 2 === 0
            // Mobile 2x2: vertical dividers on right column, horizontal between rows
            // Desktop 4x1: only vertical dividers between all cells
            const mobileBorder = [
              !isLeftCol ? "border-l border-border/60" : "",
              !isTopRow ? "border-t border-border/60" : "",
            ].join(" ")
            const desktopBorder =
              i !== 0 ? "sm:border-l sm:border-border/60 sm:border-t-0" : ""
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => onNavigate(m.href)}
                className={`group flex flex-col items-start gap-1 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:px-5 sm:py-5 ${mobileBorder} ${desktopBorder}`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {m.label}
                </span>
                <span
                  className={`text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums ${
                    m.accent ? statusStyles[m.accent].text : "text-foreground"
                  }`}
                >
                  {loading ? (
                    <span className="inline-block h-6 w-8 animate-pulse rounded bg-muted align-middle" />
                  ) : (
                    m.value
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {m.sub}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Action + Register ─────────────────────────── */}
      <section className="grid gap-0 py-6 sm:grid-cols-[1fr_240px] sm:gap-6">
        {/* Primary action — flat, operational */}
        <button
          type="button"
          onClick={() => onNavigate("/scan")}
          className="group flex flex-col justify-between gap-6 rounded-xl bg-primary px-5 py-5 text-left text-primary-foreground transition-colors hover:bg-primary/95 sm:px-6 sm:py-6"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
              Next action
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              Scan product
            </h2>
            <p className="mt-1 max-w-sm text-sm text-primary-foreground/80 leading-relaxed">
              Capture package declarations and begin an inspection record.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            Open scanner
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        {/* Register health — supporting weight */}
        <button
          type="button"
          onClick={() => onNavigate("/complaints")}
          className="flex flex-col justify-between gap-4 rounded-xl border border-border/70 px-5 py-5 text-left transition-colors hover:bg-muted/40"
        >
          <div>
            <Eyebrow>Register</Eyebrow>
            <p className="mt-2 text-sm font-medium text-foreground">Health</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {loading ? (
                <span className="inline-block h-6 w-12 animate-pulse rounded bg-muted align-middle" />
              ) : (
                `${registerHealth.pct}%`
              )}
            </p>
            <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success/70 transition-all"
                style={{ width: `${registerHealth.pct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {registerHealth.readyForReview > 0
              ? `${registerHealth.readyForReview} check${
                  registerHealth.readyForReview === 1 ? "" : "s"
                } ready for review`
              : "No checks awaiting review"}
          </p>
        </button>
      </section>

      {/* ── Recent inspections ────────────────────────── */}
      <section className="pb-8 sm:pb-10">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Latest activity</Eyebrow>
            <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-foreground">
              Recent inspections
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("/history")}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="border-t border-border/60">
          {loading && recent.length === 0 ? (
            <div>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0"
                >
                  <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-4 w-12 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                No inspections yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start your first inspection to begin building the audit trail.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("/scan")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan product
              </button>
            </div>
          ) : (
            recent.map((inspection) => (
              <InspectionRow
                key={inspection.id}
                inspection={inspection}
                onOpen={onOpen}
              />
            ))
          )}
        </div>
      </section>
    </PageContainer>
  )
}

// ─── Root (UNCHANGED behavior) ──────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [data, setData] = useState<HomeApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/home?recent=4", { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as HomeApiResponse
        if (!cancelled) setData(body)
      } catch (e) {
        if (!cancelled) setError("Could not load dashboard.")
        console.error("[home] fetch failed:", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function navigate(path: string) {
    router.push(path)
  }

  function openInspection(id: string) {
    router.push(`/inspection/${id}`)
  }

  function retry() {
    setReloadKey((k) => k + 1)
  }

  return (
    <HomeView
      data={data}
      loading={loading}
      error={error}
      onNavigate={navigate}
      onOpen={openInspection}
      onRetry={retry}
    />
  )
}