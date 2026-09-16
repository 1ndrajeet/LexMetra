import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

const V_PASS = "PASS"
const V_FAIL = "FAIL"
const V_UNCERTAIN = "UNCERTAIN"
const V_NOT_APPLICABLE = "NOT_APPLICABLE"
const V_EXEMPT = "EXEMPT"
const V_PENDING = "PENDING"

const BUCKET_COMPLIANT = [V_PASS]
const BUCKET_VIOLATION = [V_FAIL]
const BUCKET_REVIEW = [V_UNCERTAIN, V_NOT_APPLICABLE, V_EXEMPT, V_PENDING]

export type HomeApiResponse = {
  ok: true
  generatedAt: string
  metrics: {
    scannedToday: number
    compliant: number
    violations: number
    review: number
    compliancePct: number
  }
  registerHealth: {
    pct: number
    readyForReview: number
  }
  recentInspections: Array<{
    id: string
    productName: string | null
    verdict: string
    status: string
    createdAt: string
    imageCount: number
  }>
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const recentLimit = Math.min(
    Math.max(Number(searchParams.get("recent") ?? 4), 1),
    20,
  )

  // IST midnight, computed in Postgres so server TZ doesn't matter.
  const tzRows = await prisma.$queryRaw<Array<{ d: Date }>>`
    SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
           AT TIME ZONE 'Asia/Kolkata' AS d
  `
  const startOfToday = tzRows[0]?.d ?? new Date(new Date().setHours(0, 0, 0, 0))

  try {
    const [
      scannedToday,
      compliantCount,
      violationCount,
      reviewCount,
      readyForReview,
      completedCount,
      recentRaw,
    ] = await Promise.all([
      prisma.inspection.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.inspection.count({
        where: { verdict: { in: BUCKET_COMPLIANT } },
      }),
      prisma.inspection.count({
        where: { verdict: { in: BUCKET_VIOLATION } },
      }),
      prisma.inspection.count({
        where: { verdict: { in: BUCKET_REVIEW } },
      }),
      prisma.inspection.count({
        where: {
          status: "completed",
          verdict: V_UNCERTAIN,
        },
      }),
      prisma.inspection.count({
        where: { status: "completed" },
      }),
      prisma.inspection.findMany({
        orderBy: { createdAt: "desc" },
        take: recentLimit,
        select: {
          id: true,
          productName: true,
          verdict: true,
          status: true,
          createdAt: true,
          _count: { select: { images: true } },
        },
      }),
    ])

    const adjudicated = compliantCount + violationCount
    const compliancePct =
      adjudicated === 0 ? 0 : Math.round((compliantCount / adjudicated) * 100)

    const registerHealthPct =
      completedCount === 0
        ? 0
        : Math.round((compliantCount / completedCount) * 100)

    const body: HomeApiResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        scannedToday,
        compliant: compliantCount,
        violations: violationCount,
        review: reviewCount,
        compliancePct,
      },
      registerHealth: {
        pct: registerHealthPct,
        readyForReview,
      },
      recentInspections: recentRaw.map((r) => ({
        id: r.id,
        productName: r.productName,
        verdict: r.verdict,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        imageCount: r._count.images,
      })),
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.error("[api/home] failed:", err)
    return NextResponse.json(
      { ok: false, error: "Failed to load home data" },
      { status: 500 },
    )
  }
}