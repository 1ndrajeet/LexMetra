// app/api/(dashboard)/complaints/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintStatus,
} from "@/app/(dashboard)/complaints/ComplaintModal";

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

export type InspectionComplaintsResponse = {
  complaints: ComplaintListItem[];
};

// GET /api/complaints/[id] → all complaints for one inspection
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing inspection id" },
        { status: 400 },
      );
    }

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 },
      );
    }

    const complaints = await prisma.complaint.findMany({
      where: { inspectionId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        inspectionId: true,
        category: true,
        severity: true,
        status: true,
        title: true,
        description: true,
        createdAt: true,
      },
    });

    const payload: InspectionComplaintsResponse = {
      complaints: complaints.map((c) => ({
        id: c.id,
        inspectionId: c.inspectionId,
        category: c.category as ComplaintCategory,
        severity: c.severity as ComplaintSeverity,
        status: c.status as ComplaintStatus,
        title: c.title,
        description: c.description,
        createdAt: c.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[complaints/:id] fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to load complaints" },
      { status: 500 },
    );
  }
}