// app/(dashboard)/register/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronRight,
  PackageCheck,
  Calendar,
  BadgeCheck,
  FileCheck2,
  Clock,
  Filter,
  ArrowRight,
  ScanLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  seedInspections,
  statusCopy,
  type Inspection,
  type InspectionStatus,
} from "@/lib/demo-data";

function StatusBadge({ status }: { status: InspectionStatus }) {
  const styles = {
    COMPLIANT: "border-emerald-200 bg-emerald-50 text-emerald-700",
    VIOLATION: "border-rose-200 bg-rose-50 text-rose-700",
    UNCERTAIN: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {statusCopy[status].label}
    </Badge>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RegisterPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | InspectionStatus>("ALL");

  // Only show saved/compliant inspections in register
  const inspections = seedInspections.filter((item) => item.saved);

  const filtered = useMemo(() => {
    return inspections.filter((item) => {
      const matchesSearch = item.product.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "ALL" || item.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [inspections, search, filter]);

  const stats = {
    total: inspections.length,
    compliant: inspections.filter((i) => i.status === "COMPLIANT").length,
    review: inspections.filter((i) => i.status === "UNCERTAIN").length,
    violation: inspections.filter((i) => i.status === "VIOLATION").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-.03em] text-slate-900">
            Compliance Register
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Products you have explicitly verified and saved.
          </p>
        </div>
        <Button
          onClick={() => router.push("/scan")}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
        >
          <ScanLine className="h-4 w-4 mr-2" />
          New Inspection
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Saved</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-full bg-indigo-50 p-2.5 text-indigo-600">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Compliant</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.compliant}</p>
            </div>
            <div className="rounded-full bg-emerald-50 p-2.5 text-emerald-600">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Violations</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">{stats.violation}</p>
            </div>
            <div className="rounded-full bg-rose-50 p-2.5 text-rose-600">
              <PackageCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Needs Review</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{stats.review}</p>
            </div>
            <div className="rounded-full bg-amber-50 p-2.5 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or inspection IDs..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["ALL", "COMPLIANT", "VIOLATION", "UNCERTAIN"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filter === item
                  ? "bg-indigo-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item === "ALL" ? "All" : statusCopy[item].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <Card className="border-slate-200/80">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <PackageCheck className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-900">
                {search || filter !== "ALL" ? "No matching records" : "Your register is empty"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {search || filter !== "ALL"
                  ? "Try adjusting your search or filters"
                  : "Start saving compliant products from inspection results"}
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/scan")}
              >
                <ScanLine className="h-4 w-4 mr-2" />
                Scan a product
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((inspection) => (
                <div
                  key={inspection.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                  onClick={() => router.push(`/result/${inspection.id}`)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {inspection.product}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-500">{inspection.id}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {formatDate(inspection.timestamp)}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500 truncate">
                          {inspection.summary}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={inspection.status} />
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}