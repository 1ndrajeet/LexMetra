// app/inspection/[id]/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Image as ImageIcon,
  MinusCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react"

export const dynamic = "force-dynamic"

// ─── Types ──────────────────────────────────────────────────────────────────

type UiStatus = "COMPLIANT" | "VIOLATION" | "UNCERTAIN"

function toUi(verdict: string): UiStatus {
  if (verdict === "PASS") return "COMPLIANT"
  if (verdict === "FAIL") return "VIOLATION"
  return "UNCERTAIN"
}

const UI_META: Record<
  UiStatus,
  {
    label: string
    tone: string
    border: string
    strip: string
    icon: typeof CheckCircle2
    headline: string
    sub: (f: number) => string
  }
> = {
  COMPLIANT: {
    label: "Compliant",
    tone: "text-success",
    border: "border-success/30",
    strip: "bg-success/8",
    icon: CheckCircle2,
    headline: "Package looks compliant",
    sub: () => "All applicable rules passed.",
  },
  VIOLATION: {
    label: "Violation",
    tone: "text-destructive",
    border: "border-destructive/30",
    strip: "bg-destructive/8",
    icon: XCircle,
    headline: "Compliance issue found",
    sub: (f) => `${f} rule${f === 1 ? "" : "s"} failed. Review findings below.`,
  },
  UNCERTAIN: {
    label: "Needs review",
    tone: "text-warning",
    border: "border-warning/30",
    strip: "bg-warning/8",
    icon: CircleAlert,
    headline: "Inspection needs review",
    sub: () => "Some rules could not be decided from the available evidence.",
  },
}

const FINDING_META: Record<
  string,
  { tone: string; bg: string; border: string; icon: typeof CheckCircle2; label: string }
> = {
  PASS: {
    tone: "text-success",
    bg: "bg-success/6",
    border: "border-success/20",
    icon: CheckCircle2,
    label: "Pass",
  },
  FAIL: {
    tone: "text-destructive",
    bg: "bg-destructive/6",
    border: "border-destructive/20",
    icon: XCircle,
    label: "Fail",
  },
  UNCERTAIN: {
    tone: "text-warning",
    bg: "bg-warning/6",
    border: "border-warning/20",
    icon: CircleAlert,
    label: "Review",
  },
  EXEMPT: {
    tone: "text-brand",
    bg: "bg-brand/6",
    border: "border-brand/20",
    icon: ShieldCheck,
    label: "Exempt",
  },
  NOT_APPLICABLE: {
    tone: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    icon: MinusCircle,
    label: "N/A",
  },
}

const VERIF_META: Record<string, { tone: string; label: string }> = {
  VALID: { tone: "text-success", label: "Valid" },
  INVALID: { tone: "text-destructive", label: "Invalid" },
  MALFORMED: { tone: "text-destructive", label: "Malformed" },
  UNVERIFIED: { tone: "text-warning", label: "Unverified" },
  API_UNAVAILABLE: { tone: "text-muted-foreground", label: "Unavailable" },
}

function fmtDate(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d
  return t.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " · " + t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function relativeTime(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime()
  const diff = Date.now() - t
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return fmtDate(d)
}

const SEVERITY_ORDER = ["critical", "major", "minor", "informational"]
const STATUS_ORDER: Record<string, number> = {
  FAIL: 0, UNCERTAIN: 1, PASS: 2, EXEMPT: 3, NOT_APPLICABLE: 4,
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      images: { orderBy: { orderNum: "asc" } },
      extractedProducts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { extractedFields: true },
      },
      ruleResults: { orderBy: { createdAt: "asc" } },
      verificationResults: { orderBy: { createdAt: "asc" } },
      ruleEvaluation: true,
      declarations: {
        where: { field: { startsWith: "text_line_" } },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!inspection) notFound()

  const extracted = inspection.extractedProducts[0] ?? null
  const ui = toUi(inspection.verdict)
  const meta = UI_META[ui]
  const StatusIcon = meta.icon

  const summary = (inspection.ruleEvaluation?.summary as Record<string, number>) ?? {}
  const findingsByStatus: Record<string, number> = Object.keys(summary).length
    ? summary
    : inspection.ruleResults.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1
        return acc
      }, {})

  const findingsSorted = [...inspection.ruleResults].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity ?? "informational")
    const sb = SEVERITY_ORDER.indexOf(b.severity ?? "informational")
    if (sa !== sb) return sa - sb
    return (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
  })

  const failures = findingsSorted.filter((r) => r.status === "FAIL")
  const uncertain = findingsSorted.filter((r) => r.status === "UNCERTAIN")
  const passes = findingsSorted.filter((r) => r.status === "PASS")
  const exempts = findingsSorted.filter((r) => r.status === "EXEMPT")
  const notApplicable = findingsSorted.filter((r) => r.status === "NOT_APPLICABLE")

  // Primary findings = failures + uncertain (always visible)
  const primaryFindings = [...failures, ...uncertain]
  const secondaryFindings = [...passes, ...exempts, ...notApplicable]

  const groups: Array<{ title: string; rows: { label: string; value: string | null }[] }> =
    extracted
      ? [
          {
            title: "Identity",
            rows: [
              { label: "Product name", value: extracted.productName },
              { label: "Brand", value: extracted.brand },
              { label: "Generic name", value: extracted.genericName },
              { label: "Common name", value: extracted.commonName },
            ],
          },
          {
            title: "Classification",
            rows: [
              { label: "Category", value: extracted.productCategory },
              { label: "Subcategory", value: extracted.productSubcategory },
              { label: "Commodity type", value: extracted.commodityType },
              { label: "Physical state", value: extracted.commodityPhysicalState },
            ],
          },
          {
            title: "Price & quantity",
            rows: [
              {
                label: "MRP",
                value:
                  extracted.mrp != null
                    ? `${extracted.mrpCurrency ?? "INR"} ${extracted.mrp}`
                    : null,
              },
              { label: "MRP (raw)", value: extracted.mrpRawText },
              {
                label: "Net quantity",
                value:
                  extracted.netQuantityValue != null
                    ? `${extracted.netQuantityValue} ${extracted.netQuantityUnit ?? ""}`.trim()
                    : null,
              },
              { label: "Net quantity (raw)", value: extracted.netQuantityRawText },
            ],
          },
          {
            title: "Responsible parties",
            rows: [
              { label: "Manufacturer", value: extracted.manufacturer },
              { label: "Manufacturer address", value: extracted.manufacturerAddress },
              { label: "Packer", value: extracted.packer },
              { label: "Packer address", value: extracted.packerAddress },
              { label: "Importer", value: extracted.importer },
              { label: "Country of origin", value: extracted.countryOfOrigin },
            ],
          },
          {
            title: "Batch & dates",
            rows: [
              { label: "Batch number", value: extracted.batchNumber },
              { label: "Manufactured", value: extracted.manufacturedDate },
              { label: "Packed", value: extracted.packedDate },
              { label: "Expiry", value: extracted.expiryDate },
              { label: "Best before", value: extracted.bestBeforeDate },
            ],
          },
          {
            title: "Regulatory",
            rows: [
              { label: "FSSAI license", value: extracted.fssaiLicense },
              { label: "Language", value: extracted.declarationLanguage },
              {
                label: "On PDP",
                value:
                  extracted.declarationOnPdp == null
                    ? null
                    : extracted.declarationOnPdp
                      ? "Yes"
                      : "No",
              },
            ],
          },
          {
            title: "Contents",
            rows: [
              { label: "Ingredients", value: extracted.ingredients },
              { label: "Nutritional info", value: extracted.nutritionalInfo },
              { label: "Storage", value: extracted.storageInstructions },
              { label: "Usage", value: extracted.usageInstructions },
            ],
          },
          {
            title: "Consumer care",
            rows: [
              { label: "Customer care", value: extracted.customerCare },
              { label: "Phone", value: extracted.customerCarePhone },
              { label: "Email", value: extracted.customerCareEmail },
              { label: "Address", value: extracted.customerCareAddress },
              { label: "Website", value: extracted.website },
              { label: "Product code", value: extracted.productCode },
            ],
          },
        ].filter((g) => g.rows.some((r) => r.value))
      : []

  const preClassification = inspection.preClassification as
    | {
        productName?: string
        category?: string
        subcategory?: string | null
        brand?: string | null
        confidence?: number
        reasoning?: string
      }
    | null

  const backUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

  const shortId = inspection.id.slice(0, 8).toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">

        {/* ── Back nav ── */}
        <div className="mb-5">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        {/* ── Page identity ── */}
        <div className="mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Inspection
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {extracted?.productName ?? inspection.productName ?? "Untitled"}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            #{shortId} · {fmtDate(inspection.createdAt)}
          </p>
        </div>

        <div className="my-5 border-t border-border" />

        {/* ── Status strip ── */}
        <div className={`-mx-4 mb-6 border-y ${meta.border} ${meta.strip} px-4 py-4 sm:-mx-6 sm:px-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`mb-1 flex items-center gap-2 ${meta.tone}`}>
                <StatusIcon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {meta.label}
                </span>
              </div>
              <p className="text-base font-semibold">{meta.headline}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {meta.sub(failures.length)}
              </p>
            </div>

            {/* Summary counts */}
            <div className="flex shrink-0 flex-col gap-1 text-right text-xs">
              {Object.entries(findingsByStatus)
                .sort(([a], [b]) => (STATUS_ORDER[a] ?? 5) - (STATUS_ORDER[b] ?? 5))
                .map(([status, n]) => {
                  const m = FINDING_META[status] ?? FINDING_META.NOT_APPLICABLE
                  return (
                    <div key={status} className="flex items-center justify-end gap-1.5">
                      <span className="font-semibold tabular-nums">{n}</span>
                      <span className={`text-[11px] ${m.tone}`}>{m.label}</span>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Metadata row */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>{inspection.images.length} image{inspection.images.length === 1 ? "" : "s"} captured</span>
            {inspection.declarations.length > 0 && (
              <span>{inspection.declarations.length} OCR lines</span>
            )}
            {inspection.ruleEvaluation && (
              <span>
                Ruleset {inspection.ruleEvaluation.rulesetId ?? "?"}
                {inspection.ruleEvaluation.rulesetVersion
                  ? ` v${inspection.ruleEvaluation.rulesetVersion}`
                  : ""}
              </span>
            )}
          </div>
        </div>

        {/* ── Primary findings (failures + uncertain) — always visible ── */}
        {primaryFindings.length > 0 && (
          <section className="mb-8">
            <SectionHeader>Key findings</SectionHeader>
            <FindingTable items={primaryFindings} />
          </section>
        )}

        {/* ── Evidence ── */}
        {inspection.images.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              aside={`${inspection.images.length} image${inspection.images.length === 1 ? "" : "s"}`}
            >
              Evidence
            </SectionHeader>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {inspection.images.map((img) => (
                <a
                  key={img.id}
                  href={`${backUrl}/api/v1/image/${img.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${backUrl}/api/v1/image/${img.id}`}
                    alt={`Capture ${img.orderNum}`}
                    className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.04]"
                  />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    {img.orderNum}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Product information ── */}
        {extracted && groups.length > 0 && (
          <section className="mb-8">
            <SectionHeader>Product information</SectionHeader>
            {groups.map((g, gi) => (
              <div key={g.title} className={gi > 0 ? "mt-5" : ""}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {g.title}
                </p>
                <DataTable rows={g.rows} />
              </div>
            ))}
          </section>
        )}

        {/* ── Verification ── */}
        {inspection.verificationResults.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              aside={`${inspection.verificationResults.length} checked`}
            >
              Verification
            </SectionHeader>
            <div className="divide-y divide-border rounded-lg border border-border">
              {inspection.verificationResults.map((v) => {
                const m = VERIF_META[v.status] ?? { tone: "text-muted-foreground", label: v.status }
                return (
                  <div key={v.id} className="flex items-start gap-3 px-4 py-3">
                    <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${m.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{v.authority}</p>
                      {v.detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{v.detail}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${m.tone}`}>{m.label}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── All findings (passed / exempt / N/A) — collapsed ── */}
        {secondaryFindings.length > 0 && (
          <section className="mb-8">
            <Collapsible
              title="All findings"
              badge={`${secondaryFindings.length} passed / exempt`}
              defaultOpen={false}
            >
              <FindingTable items={secondaryFindings} compact />
            </Collapsible>
          </section>
        )}

        {/* ── Pre-classification ── */}
        {preClassification && (
          <section className="mb-8">
            <Collapsible
              title="Pre-classification"
              badge="Gemini · first shot"
              defaultOpen={false}
            >
              <DataTable
                rows={[
                  { label: "Product", value: preClassification.productName ?? null },
                  { label: "Category", value: preClassification.category ?? null },
                  {
                    label: "Confidence",
                    value:
                      preClassification.confidence != null
                        ? `${Math.round(preClassification.confidence * 100)}%`
                        : null,
                  },
                  { label: "Reasoning", value: preClassification.reasoning ?? null },
                ].filter((r) => r.value)}
              />
            </Collapsible>
          </section>
        )}

        {/* ── Audit ── */}
        {(extracted?.extractedFields.length ||
          extracted?.rawTextUsed ||
          inspection.declarations.length > 0) && (
          <section className="mb-8">
            <Collapsible title="Audit & raw data" defaultOpen={false}>
              <div className="space-y-4">

                {/* Field audit */}
                {extracted && extracted.extractedFields.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Field audit ({extracted.extractedFields.length})
                    </p>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {extracted.extractedFields.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-baseline gap-3 px-4 py-2.5 text-sm"
                        >
                          <span className="w-40 shrink-0 font-mono text-[11px] text-muted-foreground">
                            {f.fieldName}
                          </span>
                          <span className="min-w-0 flex-1 break-words">{f.fieldValue ?? "—"}</span>
                          {f.confidence != null && (
                            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                              {Math.round(f.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw OCR */}
                {extracted?.rawTextUsed && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Raw OCR text
                    </p>
                    <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-6 text-foreground/80">
                      {extracted.rawTextUsed}
                    </pre>
                  </div>
                )}

                {/* OCR lines */}
                {inspection.declarations.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      OCR lines ({inspection.declarations.length})
                    </p>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {inspection.declarations.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-baseline gap-3 px-4 py-2 text-sm"
                        >
                          <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">
                            {d.field.replace("text_line_", "#")}
                          </span>
                          <span className="min-w-0 flex-1 break-words">{d.value ?? "—"}</span>
                          {d.confidence != null && (
                            <span className="shrink-0 tabular-nums text-xs text-success">
                              {Math.round(d.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Collapsible>
          </section>
        )}

        {/* ── Footer actions ── */}
        <div className="mt-2 flex gap-3 border-t border-border pt-5">
          <Link
            href="/home"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/scan"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ScanLine className="h-4 w-4" />
            New inspection
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Layout primitives ───────────────────────────────────────────────────────

function SectionHeader({
  children,
  aside,
}: {
  children: React.ReactNode
  aside?: string
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold">{children}</h2>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  )
}

function Collapsible({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-border [&[open]>summary>svg.chev]:rotate-90"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 select-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {badge && (
          <span className="text-xs text-muted-foreground">{badge}</span>
        )}
        <ChevronRight className="chev h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150" />
      </summary>
      <div className="pb-5 pt-1">{children}</div>
    </details>
  )
}

// ─── Data table ─────────────────────────────────────────────────────────────

function DataTable({ rows }: { rows: { label: string; value: string | null }[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {rows
        .filter((r) => r.value)
        .map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,140px)_1fr] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,180px)_1fr]"
          >
            <p className="text-muted-foreground">{row.label}</p>
            <p className="break-words">{row.value}</p>
          </div>
        ))}
    </div>
  )
}

// ─── Finding table ───────────────────────────────────────────────────────────

function FindingTable({
  items,
  compact = false,
}: {
  items: Array<{
    id: string
    rule: string
    ruleReference: string | null
    title: string | null
    status: string
    reason: string | null
    severity: string | null
  }>
  compact?: boolean
}) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {items.map((r, idx) => {
        const m = FINDING_META[r.status] ?? FINDING_META.NOT_APPLICABLE
        const Icon = m.icon
        return (
          <div
            key={r.id}
            className={`grid grid-cols-[20px_1fr_auto] gap-3 px-4 ${compact ? "py-2.5" : "py-3"}`}
          >
            {/* Index */}
            <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {String(idx + 1).padStart(2, "0")}
            </span>

            {/* Body */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{r.rule}</span>
                {r.severity && (
                  <span className="text-[10px] text-muted-foreground/60 capitalize">
                    {r.severity}
                  </span>
                )}
              </div>
              {r.title && (
                <p className="mt-0.5 text-sm font-medium">{r.title}</p>
              )}
              {!compact && r.reason && (
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{r.reason}</p>
              )}
              {compact && r.reason && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.reason}</p>
              )}
            </div>

            {/* Status */}
            <div className="flex shrink-0 items-start gap-1.5 pt-0.5">
              <Icon className={`h-3.5 w-3.5 ${m.tone}`} />
              <span className={`text-[11px] font-semibold ${m.tone}`}>{m.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}