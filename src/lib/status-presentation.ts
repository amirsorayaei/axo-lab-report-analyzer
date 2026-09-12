import { CircleCheck, CircleHelp, Minus, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { BiomarkerStatus } from "@/lib/domain/schemas";

/**
 * Single source for a status's label, icon and colour, so the badge, counts and
 * detail panel cannot drift. Colour is only ever a reinforcing third signal.
 */
export const STATUS_PRESENTATION: Record<
  BiomarkerStatus,
  {
    label: string;
    description: string;
    icon: LucideIcon;
    badgeClass: string;
    dotClass: string;
    textClass: string;
    surfaceClass: string;
  }
> = {
  optimal: {
    label: "Optimal",
    description: "Inside an optimal range printed on the report.",
    icon: CircleCheck,
    badgeClass:
      "bg-status-optimal-surface text-status-optimal border-status-optimal/25",
    dotClass: "bg-status-optimal",
    textClass: "text-status-optimal",
    surfaceClass: "bg-status-optimal-surface",
  },
  normal: {
    label: "Normal",
    description: "Inside the reference range printed on the report.",
    icon: Minus,
    badgeClass: "bg-status-normal-surface text-status-normal border-status-normal/25",
    dotClass: "bg-status-normal",
    textClass: "text-status-normal",
    surfaceClass: "bg-status-normal-surface",
  },
  out_of_range: {
    label: "Out of range",
    description: "Outside the reference range printed on the report.",
    icon: TriangleAlert,
    badgeClass: "bg-status-out-surface text-status-out border-status-out/25",
    dotClass: "bg-status-out",
    textClass: "text-status-out",
    surfaceClass: "bg-status-out-surface",
  },
  needs_review: {
    label: "Needs review",
    description: "Not enough information on the report to classify automatically.",
    icon: CircleHelp,
    badgeClass: "bg-status-review-surface text-status-review border-status-review/25",
    dotClass: "bg-status-review",
    textClass: "text-status-review",
    surfaceClass: "bg-status-review-surface",
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
 * A censored or qualitative result ("<0,2", "Positivo") keeps its original unit:
 * a converted unit would imply a conversion that never happened.
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
