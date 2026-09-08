import { getDemoCase, type Inspection } from "./demo-data";

const INSPECTIONS_KEY = "the-inspectors-inspections";

export function loadInspections(): Inspection[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(INSPECTIONS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Inspection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInspections(inspections: Inspection[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INSPECTIONS_KEY, JSON.stringify(inspections));
}

export function getAllInspections(): Inspection[] {
  const stored = loadInspections();
  return stored.length ? stored : [];
}

export function getInspectionById(id: string): Inspection | undefined {
  return getAllInspections().find((inspection) => inspection.id === id);
}

export function persistInspection(inspection: Inspection): Inspection[] {
  const current = loadInspections();
  const next = [inspection, ...current.filter((item) => item.id !== inspection.id)];
  saveInspections(next);
  return next;
}

export function markInspectionSaved(id: string): Inspection[] {
  const current = loadInspections();
  const next = current.map((item) => (item.id === id ? { ...item, saved: true } : item));
  saveInspections(next);
  return next;
}

export async function inspectPackage(image?: string, demoSeed = Date.now()): Promise<Inspection> {
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  return getDemoCase(demoSeed, image);
}

export const ocrService = {
  async extractText(image?: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return { source: image ? "uploaded-image" : "demo-image", text: "mock structured label text" };
  },
};

export const complianceService = {
  evaluate(inspection: Inspection) {
    return inspection.status;
  },
};