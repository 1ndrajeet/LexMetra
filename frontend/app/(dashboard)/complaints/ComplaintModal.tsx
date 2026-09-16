"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  X,
  FileText,
  ListChecks,
  Check,
  XCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ───────────────────────────────────────────────────────────────────

export type ComplaintCategory =
  | "MISLABELING"
  | "QUANTITY"
  | "PRICE"
  | "LICENSE"
  | "OTHER";
export type ComplaintSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ComplaintStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

export type ComplaintFormValues = {
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  title: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
};

export type ComplaintListItem = {
  id: string;
  inspectionId: string;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  title: string;
  description: string;
  createdAt: string;
};

// ── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: "MISLABELING", label: "Mislabeling" },
  { value: "QUANTITY", label: "Net quantity" },
  { value: "PRICE", label: "MRP / pricing" },
  { value: "LICENSE", label: "License / FSSAI" },
  { value: "OTHER", label: "Other" },
];

const SEVERITIES: { value: ComplaintSeverity; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUSES: { value: ComplaintStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
];

const categoryLabel: Record<ComplaintCategory, string> = {
  MISLABELING: "Mislabeling",
  QUANTITY: "Quantity",
  PRICE: "Price",
  LICENSE: "License",
  OTHER: "Other",
};

const severityText: Record<ComplaintSeverity, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-warning",
  HIGH: "text-destructive",
};

const severitySelected: Record<ComplaintSeverity, string> = {
  LOW: "bg-muted text-foreground",
  MEDIUM: "bg-warning-soft text-warning",
  HIGH: "bg-danger-soft text-destructive",
};

const statusStyles: Record<
  ComplaintStatus,
  { text: string; bg: string; border: string; icon: React.ElementType }
> = {
  OPEN: {
    text: "text-destructive",
    bg: "bg-danger-soft",
    border: "border-destructive/20",
    icon: AlertTriangle,
  },
  UNDER_REVIEW: {
    text: "text-warning",
    bg: "bg-warning-soft",
    border: "border-warning/20",
    icon: Info,
  },
  RESOLVED: {
    text: "text-success",
    bg: "bg-success-soft",
    border: "border-success/20",
    icon: Check,
  },
  REJECTED: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    icon: XCircle,
  },
};

const statusLabel: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── File complaint modal ────────────────────────────────────────────────────

export function FileComplaintModal({
  open,
  onClose,
  inspectionId,
  productName,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  inspectionId: string;
  productName: string;
  onSubmit: (values: ComplaintFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ComplaintFormValues>({
    category: "MISLABELING",
    severity: "MEDIUM",
    title: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValues({
      category: "MISLABELING",
      severity: "MEDIUM",
      title: "",
      description: "",
      contactEmail: "",
      contactPhone: "",
    });
    setError(null);
    setSubmitting(false);
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  useModalChrome(open, submitting, onClose);
  if (!open) return null;

  const canSubmit =
    values.title.trim().length >= 3 &&
    values.description.trim().length >= 10 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch {
      setError("Could not file complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      eyebrow="File complaint"
      title={productName}
      subtitle={`Inspection record · ${inspectionId.slice(0, 8)}`}
      icon={<FileText className="h-4 w-4 text-primary" />}
      iconBg="bg-primary/10 border-primary/20"
      onClose={onClose}
      submitting={submitting}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="fc-category">
              <select
                id="fc-category"
                value={values.category}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    category: e.target.value as ComplaintCategory,
                  }))
                }
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Severity" htmlFor="fc-severity">
              <div
                id="fc-severity"
                role="radiogroup"
                aria-label="Severity"
                className="flex h-10 items-center gap-1 rounded-lg border border-border bg-background p-1"
              >
                {SEVERITIES.map((s) => {
                  const active = values.severity === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        setValues((v) => ({ ...v, severity: s.value }))
                      }
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? severitySelected[s.value]
                          : "text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <Field
            label="Title"
            htmlFor="fc-title"
            hint={`${values.title.length}/120`}
          >
            <input
              ref={firstFieldRef}
              id="fc-title"
              value={values.title}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value.slice(0, 120) }))
              }
              placeholder="e.g. MRP not printed on pack"
              className={inputCls}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="fc-desc"
            hint={`${values.description.length}/4000`}
          >
            <textarea
              id="fc-desc"
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  description: e.target.value.slice(0, 4000),
                }))
              }
              rows={5}
              placeholder="Describe what is wrong, what the label says, and any evidence you already captured."
              className={`${inputCls} h-auto min-h-[120px] resize-none py-2 leading-relaxed`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact email" htmlFor="fc-email" optional>
              <input
                id="fc-email"
                type="email"
                value={values.contactEmail}
                onChange={(e) =>
                  setValues((v) => ({ ...v, contactEmail: e.target.value }))
                }
                placeholder="you@example.com"
                className={inputCls}
              />
            </Field>
            <Field label="Contact phone" htmlFor="fc-phone" optional>
              <input
                id="fc-phone"
                type="tel"
                value={values.contactPhone}
                onChange={(e) =>
                  setValues((v) => ({ ...v, contactPhone: e.target.value }))
                }
                placeholder="+91 …"
                className={inputCls}
              />
            </Field>
          </div>

          {error && (
            <div className="border-l-2 border-destructive bg-danger-soft/60 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <ModalFooter
          hint="Filed against this inspection record."
          submitting={submitting}
          onClose={onClose}
          submitLabel="File complaint"
          submittingLabel="Filing…"
          disabled={!canSubmit}
        />
      </form>
    </ModalShell>
  );
}

// ── Manage complaints modal ─────────────────────────────────────────────────

export function ManageComplaintsModal({
  open,
  onClose,
  inspectionId,
  productName,
  complaints,
  loading,
  onUpdateStatus,
  onFileNew,
}: {
  open: boolean;
  onClose: () => void;
  inspectionId: string;
  productName: string;
  complaints: ComplaintListItem[];
  loading: boolean;
  onUpdateStatus: (id: string, status: ComplaintStatus) => Promise<void>;
  onFileNew: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  useModalChrome(open, false, onClose);
  if (!open) return null;

  async function change(id: string, status: ComplaintStatus) {
    setBusyId(id);
    try {
      await onUpdateStatus(id, status);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModalShell
      eyebrow="Complaints"
      title={productName}
      subtitle={`Inspection record · ${inspectionId.slice(0, 8)}`}
      icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
      iconBg="bg-muted border-border"
      onClose={onClose}
      submitting={false}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="divide-y divide-border">
              {[0, 1].map((i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="mt-3 h-2.5 w-4/5 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No complaints filed
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                File the first complaint against this record.
              </p>
              <button
                type="button"
                onClick={onFileNew}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-2"
              >
                File complaint
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {complaints.map((c) => {
                const s = statusStyles[c.status];
                const Icon = s.icon;
                const transitions = STATUSES.filter(
                  (x) => x.value !== c.status,
                );
                const busy = busyId === c.id;
                return (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {categoryLabel[c.category]}
                          <span className="mx-1 opacity-40">·</span>
                          {formatDate(c.createdAt)}
                          <span className="mx-1 opacity-40">·</span>
                          <span
                            className={`font-medium ${severityText[c.severity]}`}
                          >
                            {c.severity}
                          </span>
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${s.bg} ${s.text} ${s.border}`}
                      >
                        <Icon className="h-3 w-3" />
                        {statusLabel[c.status]}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {c.description}
                    </p>

                    {transitions.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1">
                        {transitions.map((x) => (
                          <button
                            key={x.value}
                            type="button"
                            disabled={busy}
                            onClick={() => change(c.id, x.value)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Mark {x.label.toLowerCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            Status changes are audit-tracked.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onFileNew}>
              File new
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared shell ────────────────────────────────────────────────────────────

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15";

function useModalChrome(
  open: boolean,
  submitting: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, submitting, onClose]);
}

function ModalShell({
  eyebrow,
  title,
  subtitle,
  icon,
  iconBg,
  onClose,
  submitting,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  onClose: () => void;
  submitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-xl border border-border bg-card shadow-xl sm:rounded-xl">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${iconBg}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="mt-1 truncate text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  hint,
  submitting,
  onClose,
  submitLabel,
  submittingLabel,
  disabled,
}: {
  hint: string;
  submitting: boolean;
  onClose: () => void;
  submitLabel: string;
  submittingLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {submittingLabel}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
          {optional && (
            <span className="ml-1.5 font-normal text-muted-foreground/60">
              (optional)
            </span>
          )}
        </label>
        {hint && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}