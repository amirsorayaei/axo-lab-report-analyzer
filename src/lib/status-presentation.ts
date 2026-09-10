import type { BiomarkerStatus } from "@/lib/domain/schemas";

/**
 * One place where a status becomes a label, a colour and an explanation, so the
 * badge, the summary cards and the detail panel can never drift apart.
 */
export const STATUS_PRESENTATION: Record<
  BiomarkerStatus,
  { label: string; description: string; badgeClass: string; dotClass: string }
> = {
  optimal: {
    label: "Optimal",
    description: "Inside an optimal range printed on the report.",
    badgeClass:
      "bg-status-optimal-surface text-status-optimal border-status-optimal/25",
    dotClass: "bg-status-optimal",
  },
  normal: {
    label: "Normal",
    description: "Inside the reference range printed on the report.",
    badgeClass: "bg-status-normal-surface text-status-normal border-status-normal/25",
    dotClass: "bg-status-normal",
  },
  out_of_range: {
    label: "Out of range",
    description: "Outside the reference range printed on the report.",
    badgeClass: "bg-status-out-surface text-status-out border-status-out/25",
    dotClass: "bg-status-out",
  },
  needs_review: {
    label: "Needs review",
    description: "Not enough information on the report to classify automatically.",
    badgeClass: "bg-status-review-surface text-status-review border-status-review/25",
    dotClass: "bg-status-review",
  },
};

export const STATUS_ORDER: BiomarkerStatus[] = [
  "out_of_range",
  "needs_review",
  "optimal",
  "normal",
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A result is only ever shown in the standardized unit when the value itself
 * could be standardized. A censored or qualitative result ("<0,2", "Positivo")
 * keeps its original unit, because pairing it with a converted unit would imply
 * a conversion that never happened.
 */
export function formatResult(biomarker: {
  standardizedValue: number | null;
  standardizedUnit: string | null;
  originalValue: string;
  originalUnit: string | null;
  conversionApplied: boolean;
}): { value: string; unit: string | null; conversionNote: string | null } {
  if (biomarker.standardizedValue === null) {
    return {
      value: biomarker.originalValue,
      unit: biomarker.originalUnit,
      conversionNote: null,
    };
  }

  return {
    value: String(biomarker.standardizedValue),
    unit: biomarker.standardizedUnit,
    conversionNote: biomarker.conversionApplied
      ? `from ${biomarker.originalValue} ${biomarker.originalUnit ?? ""}`.trim()
      : null,
  };
}
