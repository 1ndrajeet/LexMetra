// app/api/(dashboard)/complaints/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// ── Types ───────────────────────────────────────────────────────────────────

export type ComplaintCategory =
  | "MISLABELING"
  | "QUANTITY"
  | "PRICE"
  | "LICENSE"
  | "OTHER";
export type ComplaintSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ComplaintStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

export type RegisterRecord = {
  id: string;
  productName: string | null;
  verdict: string;
  status: string;
  createdAt: string;
  summary: string | null;
  imageCount: number;
  complaintCount: number;
  openComplaintCount: number;
};

export type ComplaintsApiResponse = {
  records: RegisterRecord[];
};

// ── Validation ──────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  inspectionId: z.string().min(1),
  category: z.enum(["MISLABELING", "QUANTITY", "PRICE", "LICENSE", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(20).optional().or(z.literal("")),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"]),
});

// ── GET: inspections + complaint counts ─────────────────────────────────────

export async function GET() {
  try {
    const inspections = await prisma.inspection.findMany({
      where: {
        status: "completed",
        verdict: { in: ["PASS", "FAIL", "UNCERTAIN"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        productName: true,
        verdict: true,
        status: true,
        createdAt: true,
        ruleEvaluation: { select: { summary: true } },
        _count: { select: { images: true, complaints: true } },
        complaints: {
          where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
          select: { id: true },
        },
      },
    });

    const records: RegisterRecord[] = inspections.map((i) => {
      let summary: string | null = null;
      const raw = i.ruleEvaluation?.summary;
      if (raw && typeof raw === "object" && "summary" in raw) {
        const s = (raw as any).summary;
        if (typeof s === "string") summary = s;
      }
      return {
        id: i.id,
        productName: i.productName,
        verdict: i.verdict,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        summary,
        imageCount: i._count.images,
        complaintCount: i._count.complaints,
        openComplaintCount: i.complaints.length,
      };
    });

    return NextResponse.json<ComplaintsApiResponse>({ records });
  } catch (err) {
    console.error("[complaints] list failed:", err);
    return NextResponse.json({ error: "Failed to load register" }, { status: 500 });
  }
}

// ── POST: file a complaint ──────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const d = parsed.data;

    const inspection = await prisma.inspection.findUnique({
      where: { id: d.inspectionId },
      select: { id: true },
    });
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const created = await prisma.complaint.create({
      data: {
        inspectionId: d.inspectionId,
        category: d.category,
        severity: d.severity,
        title: d.title,
        description: d.description,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
      },
      select: { id: true, createdAt: true, status: true },
    });

    return NextResponse.json({ complaint: created }, { status: 201 });
  } catch (err) {
    console.error("[complaints] create failed:", err);
    return NextResponse.json({ error: "Failed to file complaint" }, { status: 500 });
  }
}

// ── PATCH: update complaint status ──────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { id, status } = parsed.data;
    const updated = await prisma.complaint.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
    return NextResponse.json({ complaint: updated });
  } catch (err) {
    console.error("[complaints] update failed:", err);
    return NextResponse.json({ error: "Failed to update complaint" }, { status: 500 });
  }
}