"use client"

import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  Brain,
  CameraOff,
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  ReceiptIcon,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"
const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const GEMINI_MODEL = "gemini-2.5-flash"
const MAX_SHOTS = 3

// ─── Types ──────────────────────────────────────────────────────────────────

type Category =
  | "food"
  | "beverage"
  | "drug"
  | "cosmetic"
  | "medicalDevice"
  | "household"
  | "agricultural"
  | "industrial"
  | "other"

type ClassifyResult = {
  productName: string
  brand: string | null
  genericName: string | null
  category: Category
  subcategory: string | null
  confidence: number
  reasoning: string
}

type ClassifyState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ready"; result: ClassifyResult }
  | { status: "failed"; reason: string }

type Phase =
  | { kind: "capture" }
  | { kind: "uploading"; preview: string[]; productName: string; files: number }
  | { kind: "inspecting"; inspectionId: string }
  | { kind: "error"; message: string; detail?: string }

// ─── Utils ──────────────────────────────────────────────────────────────────

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () =>
      typeof r.result === "string" ? resolve(r.result) : reject(new Error("read failed"))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], name, { type: blob.type || "image/jpeg" })
}

// ─── Gemini (background, first image only) ──────────────────────────────────

const CLASSIFY_PROMPT = `You are a product label classifier for Indian Legal Metrology compliance.

You will receive ONE photograph of a packaged commodity.

Identify what the product IS. Do not check compliance.

Return ONLY valid JSON:
{
  "productName": "string",
  "brand": "string|null",
  "genericName": "string|null",
  "category": "food|beverage|drug|cosmetic|medicalDevice|household|agricultural|industrial|other",
  "subcategory": "string|null",
  "confidence": 0.0,
  "reasoning": "one short sentence"
}

CATEGORY RULES:
- "beverage" ONLY for drinks consumed as a liquid: coffee, tea, soft drinks, juices, water, milk drinks, energy drinks, malt drinks.
- "food" for everything else edible: snacks, biscuits, spices, sauces, ready-to-eat, dairy solids, oils, grains, sweets.
- Instant coffee powder → beverage. Coffee beans → beverage. Coffee creamer → food.
- Bru / Nescafé / Tata Tea / Bournvita / Horlicks → beverage.
- Biscuits, chips, namkeen, chocolate, masala, atta → food.
- Soap, shampoo, lotion, toothpaste → cosmetic.
- Medicine, tablets, syrups → drug.
- Cleaners, detergents, mosquito repellent → household.
- Fertiliser, pesticide, seeds → agricultural.
- If you cannot decide, use "other".

Be decisive. If the brand is recognisable, use that knowledge.

Return ONLY the JSON.`

async function classifyWithGemini(dataUrl: string): Promise<ClassifyResult> {
  if (!GEMINI_KEY) throw new Error("NEXT_PUBLIC_GEMINI_API_KEY missing")

  const [meta, b64] = dataUrl.split(",")
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? "image/jpeg"

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: CLASSIFY_PROMPT },
              { inline_data: { mime_type: mime, data: b64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 160)}`)
  }

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const raw = body.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

  const parsed = JSON.parse(cleaned) as Partial<ClassifyResult>
  const valid: Category[] = [
    "food", "beverage", "drug", "cosmetic", "medicalDevice",
    "household", "agricultural", "industrial", "other",
  ]
  return {
    productName: String(parsed.productName ?? "").trim() || "Unknown product",
    brand: parsed.brand ? String(parsed.brand).trim() : null,
    genericName: parsed.genericName ? String(parsed.genericName).trim() : null,
    category: valid.includes(parsed.category as Category) ? (parsed.category as Category) : "other",
    subcategory: parsed.subcategory ? String(parsed.subcategory).trim() : null,
    confidence: Number(parsed.confidence) || 0,
    reasoning: String(parsed.reasoning ?? ""),
  }
}

// ─── Backend ────────────────────────────────────────────────────────────────

async function uploadToBackend(files: File[], productName: string) {
  const form = new FormData()
  for (const f of files) form.append("files", f)
  if (productName) form.append("product_name", productName)
  const res = await fetch(`${BACKEND}/api/v1/upload`, { method: "POST", body: form })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  return res.json() as Promise<{ inspection_id: string }>
}

async function runInspection(inspectionId: string) {
  const res = await fetch(`${BACKEND}/api/v1/inspect/${inspectionId}`, { method: "POST" })
  if (!res.ok) throw new Error(`Inspection failed (${res.status})`)
  return res.json()
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const classifyTokenRef = useRef(0)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [captured, setCaptured] = useState<string[]>([])
  const [classify, setClassify] = useState<ClassifyState>({ status: "idle" })
  const [manualName, setManualName] = useState("")
  const [manualMode, setManualMode] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: "capture" })

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  // ─── Camera ───────────────────────────────────────────────────────────────

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraActive(true)
      setCameraError(null)
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Camera denied")
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  // ─── Classification kickoff ──────────────────────────────────────────────

  function fireClassification(firstImage: string) {
    const token = ++classifyTokenRef.current
    setClassify({ status: "running" })
    setManualMode(false)

    classifyWithGemini(firstImage)
      .then((result) => {
        if (token !== classifyTokenRef.current) return // stale
        setClassify({ status: "ready", result })
      })
      .catch((err: unknown) => {
        if (token !== classifyTokenRef.current) return
        const reason = err instanceof Error ? err.message : "Classification failed"
        setClassify({ status: "failed", reason })
        setManualMode(true)
      })
  }

  function addImage(dataUrl: string) {
    setCaptured((prev) => {
      const next = [...prev, dataUrl].slice(0, MAX_SHOTS)
      // Fire classification only on the FIRST image ever added.
      if (prev.length === 0 && next.length > 0) {
        fireClassification(next[0])
      }
      return next
    })
  }

  function removeImage(index: number) {
    setCaptured((prev) => {
      const next = prev.filter((_, i) => i !== index)
      // If we removed the first image, reset classification.
      if (index === 0) {
        classifyTokenRef.current++ // invalidate any in-flight request
        setClassify({ status: "idle" })
        setManualMode(false)
        setManualName("")
        // If there's a new first image, classify it.
        if (next.length > 0) fireClassification(next[0])
      }
      return next
    })
  }

  function capturePhoto() {
    if (captured.length >= MAX_SHOTS) return
    const video = videoRef.current
    if (!cameraActive || !video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1080
    canvas.height = video.videoHeight || 1440
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
    addImage(canvas.toDataURL("image/jpeg", 0.85))
  }

  async function pickFromGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] // single image only
    e.target.value = ""
    if (!file) return
    if (captured.length >= MAX_SHOTS) return
    const dataUrl = await fileToDataUrl(file)
    addImage(dataUrl)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const atLimit = captured.length >= MAX_SHOTS
  const canContinue =
    captured.length > 0 &&
    (classify.status === "ready" ||
      (manualMode && manualName.trim().length >= 2))

  const effectiveName = manualMode
    ? manualName.trim()
    : classify.status === "ready"
      ? classify.result.productName
      : ""

  // ─── Pipeline ─────────────────────────────────────────────────────────────

  async function continueToSubmit() {
    if (!canContinue) return
    stopCamera()
    try {
      setPhase({
        kind: "uploading",
        preview: captured,
        productName: effectiveName,
        files: captured.length,
      })

      const files = await Promise.all(
        captured.map((d, i) => dataUrlToFile(d, `capture-${i + 1}.jpg`)),
      )
      const upload = await uploadToBackend(files, effectiveName)
      if (!upload.inspection_id) throw new Error("No inspection id returned")

      setPhase({ kind: "inspecting", inspectionId: upload.inspection_id })
      const result = await runInspection(upload.inspection_id)

      try {
        sessionStorage.setItem(
          `lexmetra.inspection.${upload.inspection_id}`,
          JSON.stringify(result),
        )
        if (classify.status === "ready") {
          sessionStorage.setItem(
            `lexmetra.classification.${upload.inspection_id}`,
            JSON.stringify(classify.result),
          )
        }
      } catch {}

      router.push(`/inspection/${upload.inspection_id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setPhase({ kind: "error", message: "Inspection could not be completed", detail: message })
    }
  }

  function back() {
    stopCamera()
    if (phase.kind === "error") { setPhase({ kind: "capture" }); return }
    router.back()       
  }

  // ─── Render: uploading / inspecting ─────────────────────────────────────

  if (phase.kind === "uploading" || phase.kind === "inspecting") {
    const steps =
      phase.kind === "uploading"
        ? [
            { label: "Sending images", state: "active" as const },
            { label: "OCR + extraction", state: "pending" as const },
            { label: "Rule engine", state: "pending" as const },
          ]
        : [
            { label: "Sending images", state: "done" as const },
            { label: "OCR + extraction", state: "active" as const },
            { label: "Rule engine", state: "active" as const },
          ]

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft">
            <Loader2 className="h-9 w-9 animate-spin text-brand" />
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-brand">
            Inspection pipeline
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.05em]">
            {phase.kind === "uploading" ? "Uploading" : "Analyzing package"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {phase.kind === "uploading"
              ? `Sending ${phase.files} image${phase.files === 1 ? "" : "s"} as "${phase.productName}".`
              : "Running OCR, extraction and the Legal Metrology rule engine."}
          </p>

          <div className="mt-10 space-y-2 text-left">
            {steps.map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                  s.state === "done"
                    ? "bg-success-soft"
                    : s.state === "active"
                      ? "bg-brand-soft"
                      : "bg-muted"
                }`}
              >
                {s.state === "done" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-success-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : s.state === "active" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-background/60" />
                )}
                <span className="text-sm font-semibold">{s.label}</span>
                {s.state === "active" && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-brand">
                    Working
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: error ──────────────────────────────────────────────────────

  if (phase.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger-soft">
            <CameraOff className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-[-.04em]">
            {phase.message}
          </h1>
          {phase.detail && (
            <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
              {phase.detail}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setPhase({ kind: "capture" })}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to capture
            </button>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-muted px-5 text-sm font-semibold transition-transform active:scale-[.98]"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: capture ────────────────────────────────────────────────────

  const cat = classify.status === "ready" ? classify.result.category : null
  const catTone =
    cat === "food" || cat === "beverage"
      ? "bg-success-soft text-success"
      : cat === "other"
        ? "bg-warning-soft text-warning"
        : "bg-brand-soft text-brand"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-8 pt-5 sm:px-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground transition-transform active:scale-[.95]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-muted-foreground">
              Capture
            </p>
            <h1 className="mt-1 text-base font-semibold tracking-[-.02em]">
              Scan product
            </h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        {/* Viewport */}
        <div className="flex flex-1 flex-col justify-center py-6">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] bg-neutral-900 shadow-2xl shadow-black/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`}
            />

            {cameraActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[72%] w-[72%]">
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-white/80" />
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-white/80" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-white/80" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-white/80" />
                </div>
              </div>
            )}

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
                  <Aperture className="h-8 w-8 text-white/80" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">
                  Camera preview
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-white/60">
                  Position the package label inside the frame.
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 transition-transform active:scale-[.97]"
                >
                  <Aperture className="h-4 w-4" />
                  Enable camera
                </button>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-x-5 bottom-5 flex items-center gap-2 rounded-2xl bg-warning/20 px-3 py-2 text-xs text-warning backdrop-blur">
                <CameraOff className="h-4 w-4 shrink-0" />
                <span className="truncate">{cameraError}</span>
              </div>
            )}

            {/* Shot counter */}
            <div className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              {captured.length}/{MAX_SHOTS}
            </div>
          </div>

          {/* Thumbnails row — appears inline, no border */}
          {captured.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                  Shots
                </p>
                <button
                  type="button"
                  onClick={() => {
                    classifyTokenRef.current++
                    setCaptured([])
                    setClassify({ status: "idle" })
                    setManualMode(false)
                    setManualName("")
                  }}
                  className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {captured.map((src, i) => (
                  <div
                    key={i}
                    className="group relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Shot ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label={`Remove shot ${i + 1}`}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-transform active:scale-[.9]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classification status card — no border, soft bg */}
          {captured.length > 0 && (
            <div className="mt-4 rounded-3xl bg-muted p-4">
              {classify.status === "idle" && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-background">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Waiting to identify product…
                  </p>
                </div>
              )}

              {classify.status === "running" && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-background">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Identifying product</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Reading the primary shot…
                    </p>
                  </div>
                </div>
              )}

              {classify.status === "ready" && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-background">
                    <ReceiptIcon className="h-4 w-4 text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {classify.result.productName}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${catTone}`}
                      >
                        {classify.result.category}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[classify.result.brand, classify.result.subcategory]
                        .filter(Boolean)
                        .join(" · ") || classify.result.reasoning}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualMode(true)
                      setManualName(classify.result.productName)
                    }}
                    aria-label="Edit name"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground transition-transform active:scale-[.9]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {classify.status === "failed" && (
                <div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-background">
                      <Pencil className="h-4 w-4 text-warning" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        Couldn't identify automatically
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {classify.reason}
                      </p>
                    </div>
                  </div>
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Enter product name"
                    className="mt-3 h-11 w-full rounded-2xl bg-background px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand/30"
                    autoFocus
                  />
                </div>
              )}

              {manualMode && classify.status === "ready" && (
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Enter product name"
                  className="mt-3 h-11 w-full rounded-2xl bg-background px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand/30"
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={atLimit}
            aria-label="Pick from gallery"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground transition-transform active:scale-[.95] disabled:opacity-40"
          >
            <ImagePlus className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={capturePhoto}
            disabled={!cameraActive || atLimit}
            aria-label="Capture photo"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background shadow-lg shadow-black/10 transition-transform active:scale-[.95] disabled:opacity-40"
          >
            <Aperture className="h-7 w-7" />
          </button>

          <button
            type="button"
            onClick={continueToSubmit}
            disabled={!canContinue}
            aria-label="Continue"
            className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.97] disabled:opacity-40"
          >
            {classify.status === "running" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Identifying…</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={pickFromGallery}
          className="hidden"
        />
      </div>
    </div>
  )
}