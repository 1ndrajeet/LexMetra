export type InspectionStatus = "COMPLIANT" | "VIOLATION" | "UNCERTAIN";
export type DeclarationStatus = "VERIFIED" | "MISSING" | "REVIEW";

export type Declaration = {
  field: string;
  value: string;
  status: DeclarationStatus;
  confidence: number;
  evidenceNote?: string;
};

export type EvidenceRegion = {
  label: string;
  value: string;
  confidence: number;
  top: number;
  left: number;
  width: number;
  height: number;
};

export type Inspection = {
  id: string;
  product: string;
  manufacturer: string;
  quantity: string;
  status: InspectionStatus;
  summary: string;
  timestamp: string;
  dateLabel: string;
  declarations: Declaration[];
  evidence: EvidenceRegion[];
  image?: string;
  saved: boolean;
  score: number;
};

export const statusCopy: Record<InspectionStatus, { label: string; short: string }> = {
  COMPLIANT: { label: "Compliant", short: "Verified" },
  VIOLATION: { label: "Violation", short: "Issue found" },
  UNCERTAIN: { label: "Uncertain", short: "Needs review" },
};

const compliantDeclarations: Declaration[] = [
  { field: "Product name", value: "Tata Salt", status: "VERIFIED", confidence: 99 },
  { field: "Manufacturer / Packer", value: "Tata Consumer Products Ltd.", status: "VERIFIED", confidence: 97 },
  { field: "Net quantity", value: "1 kg", status: "VERIFIED", confidence: 98, evidenceNote: "Net quantity detected from front label" },
  { field: "MRP", value: "₹28.00", status: "VERIFIED", confidence: 96, evidenceNote: "MRP ₹28.00" },
  { field: "Packed on", value: "06/2026", status: "VERIFIED", confidence: 94 },
  { field: "Best before", value: "12 months", status: "VERIFIED", confidence: 93 },
  { field: "Consumer care", value: "1800-108-4488", status: "VERIFIED", confidence: 91 },
  { field: "Country of origin", value: "India", status: "VERIFIED", confidence: 99 },
];

const violationDeclarations: Declaration[] = [
  { field: "Product name", value: "Demo Shampoo", status: "VERIFIED", confidence: 99 },
  { field: "Manufacturer / Packer", value: "Apex Personal Care India", status: "VERIFIED", confidence: 94 },
  { field: "Net quantity", value: "200 ml", status: "VERIFIED", confidence: 97 },
  { field: "MRP", value: "₹180.00", status: "VERIFIED", confidence: 95, evidenceNote: "MRP ₹180.00" },
  { field: "Packed on", value: "05/2026", status: "VERIFIED", confidence: 89 },
  { field: "Best before", value: "Not detected", status: "REVIEW", confidence: 58 },
  { field: "Consumer care", value: "Not detected", status: "MISSING", confidence: 16 },
  { field: "Country of origin", value: "India", status: "VERIFIED", confidence: 96 },
];

const uncertainDeclarations: Declaration[] = [
  { field: "Product name", value: "Demo Food Package", status: "VERIFIED", confidence: 89 },
  { field: "Manufacturer / Packer", value: "Not confidently extracted", status: "REVIEW", confidence: 54 },
  { field: "Net quantity", value: "Could not be extracted", status: "REVIEW", confidence: 31 },
  { field: "MRP", value: "₹—", status: "REVIEW", confidence: 42 },
  { field: "Packed on", value: "Not detected", status: "REVIEW", confidence: 37 },
  { field: "Best before", value: "Not detected", status: "REVIEW", confidence: 33 },
  { field: "Consumer care", value: "Not detected", status: "REVIEW", confidence: 29 },
  { field: "Country of origin", value: "India", status: "VERIFIED", confidence: 81 },
];

const evidence = (regions: EvidenceRegion[]): EvidenceRegion[] => regions;

export const seedInspections: Inspection[] = [
  {
    id: "LM-2026-0042",
    product: "Tata Salt",
    manufacturer: "Tata Consumer Products Ltd.",
    quantity: "1 kg",
    status: "COMPLIANT",
    summary: "8/8 declarations verified",
    timestamp: "2026-09-05T10:32:00+05:30",
    dateLabel: "Today, 10:32 AM",
    declarations: compliantDeclarations,
    evidence: evidence([
      { label: "MRP", value: "₹28.00", confidence: 96, top: 22, left: 43, width: 38, height: 18 },
      { label: "NET QTY", value: "1 kg", confidence: 98, top: 57, left: 12, width: 35, height: 18 },
      { label: "PACKED ON", value: "06/2026", confidence: 94, top: 76, left: 48, width: 38, height: 13 },
    ]),
    saved: true,
    score: 100,
  },
  {
    id: "LM-2026-0039",
    product: "Demo Shampoo",
    manufacturer: "Apex Personal Care India",
    quantity: "200 ml",
    status: "VIOLATION",
    summary: "6 verified · 2 require action",
    timestamp: "2026-09-05T09:48:00+05:30",
    dateLabel: "Today, 09:48 AM",
    declarations: violationDeclarations,
    evidence: evidence([{ label: "MRP", value: "₹180.00", confidence: 95, top: 29, left: 52, width: 33, height: 16 }]),
    saved: true,
    score: 75,
  },
  {
    id: "LM-2026-0036",
    product: "Demo Food Package",
    manufacturer: "Not confidently extracted",
    quantity: "Review required",
    status: "UNCERTAIN",
    summary: "Net quantity requires review",
    timestamp: "2026-09-04T15:16:00+05:30",
    dateLabel: "Yesterday, 03:16 PM",
    declarations: uncertainDeclarations,
    evidence: [],
    saved: false,
    score: 42,
  },
  {
    id: "LM-2026-0031",
    product: "Parle-G Biscuits",
    manufacturer: "Parle Products Pvt. Ltd.",
    quantity: "250 g",
    status: "COMPLIANT",
    summary: "8/8 declarations verified",
    timestamp: "2026-09-03T11:12:00+05:30",
    dateLabel: "03 Sep, 11:12 AM",
    declarations: compliantDeclarations.map((item) => ({ ...item, value: item.field === "Product name" ? "Parle-G Biscuits" : item.value })),
    evidence: [],
    saved: true,
    score: 100,
  },
];

export function cloneInspection(template: Inspection, image?: string): Inspection {
  const id = `LM-2026-${String(Math.floor(1000 + Math.random() * 8999))}`;
  const next: Inspection = {
    ...template,
    id,
    timestamp: new Date().toISOString(),
    dateLabel: "Just now",
    saved: false,
  };
  if (image) next.image = image;
  return next;
}

export function getDemoCase(seed: number, image?: string): Inspection {
  const template = seed % 3 === 0 ? seedInspections[2] : seed % 2 === 0 ? seedInspections[1] : seedInspections[0];
  const fallback = seedInspections[0];
  if (!template && fallback) return cloneInspection(fallback, image);
  if (!template) throw new Error("Demo inspection fixtures are unavailable");
  return cloneInspection(template, image);
}