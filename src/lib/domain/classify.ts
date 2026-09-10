import type {
  BiomarkerStatus,
  Sex,
  StandardizedRange,
} from "@/lib/domain/schemas";

/**
 * Deterministic classification.
 *
 * The model never returns a status. It only transcribes values and the ranges
 * printed on the report; the decision below is made in TypeScript from those
 * facts alone. No threshold is ever supplied by this application.
 *
 * Decision order:
 *   1. No parsable numeric value                     -> needs_review
 *   2. Value/range unit mismatch                     -> needs_review
 *   3. No applicable range at all                    -> needs_review
 *   4. A range that requires age/sex we do not have  -> needs_review
 *   5. Ambiguity: several applicable ranges disagree -> needs_review
 *   6. Inside an applicable OPTIMAL range            -> optimal
 *   7. Inside an applicable REFERENCE range          -> normal
 *   8. Outside an applicable REFERENCE range         -> out_of_range
 */

export type PatientContext = {
  ageYears: number | null;
  sex: Sex | null;
};

export type ClassificationInput = {
  standardizedValue: number | null;
  originalValue: string;
  standardizedUnit: string | null;
  referenceRanges: StandardizedRange[];
  optimalRanges: StandardizedRange[];
  patient: PatientContext;
};

export type ClassificationOutput = {
  status: BiomarkerStatus;
  reason: string;
  appliedReferenceRange: StandardizedRange | null;
  appliedOptimalRange: StandardizedRange | null;
};

type Applicability =
  | { kind: "applicable"; specificity: number }
  | { kind: "not_applicable" }
  | { kind: "unknown_context"; missing: "age" | "sex" };

/**
 * A range applies when every demographic condition it states is satisfied.
 * A range with no stated condition applies to everyone. When a range states a
 * condition we cannot evaluate (report gave no age or no sex), the biomarker is
 * ambiguous rather than assumed to match.
 */
function evaluateApplicability(
  range: StandardizedRange,
  patient: PatientContext,
): Applicability {
  let specificity = 0;

  if (range.appliesToSex !== null) {
    if (patient.sex === null) return { kind: "unknown_context", missing: "sex" };
    if (patient.sex !== range.appliesToSex) return { kind: "not_applicable" };
    specificity += 2;
  }

  const hasAgeBound =
    range.appliesToAgeMinYears !== null || range.appliesToAgeMaxYears !== null;

  if (hasAgeBound) {
    if (patient.ageYears === null) return { kind: "unknown_context", missing: "age" };
    if (
      range.appliesToAgeMinYears !== null &&
      patient.ageYears < range.appliesToAgeMinYears
    ) {
      return { kind: "not_applicable" };
    }
    if (
      range.appliesToAgeMaxYears !== null &&
      patient.ageYears > range.appliesToAgeMaxYears
    ) {
      return { kind: "not_applicable" };
    }
    specificity += 1;
  }

  return { kind: "applicable", specificity };
}

function hasBound(range: StandardizedRange): boolean {
  return range.standardizedMin !== null || range.standardizedMax !== null;
}

export function isWithinRange(value: number, range: StandardizedRange): boolean {
  if (range.standardizedMin !== null) {
    const ok = range.minInclusive
      ? value >= range.standardizedMin
      : value > range.standardizedMin;
    if (!ok) return false;
  }
  if (range.standardizedMax !== null) {
    const ok = range.maxInclusive
      ? value <= range.standardizedMax
      : value < range.standardizedMax;
    if (!ok) return false;
  }
  return true;
}

export function formatRange(range: StandardizedRange): string {
  const unit = range.standardizedUnit ? ` ${range.standardizedUnit}` : "";
  const { standardizedMin: min, standardizedMax: max } = range;

  if (min !== null && max !== null) return `${min} – ${max}${unit}`;
  if (max !== null) return `${range.maxInclusive ? "≤" : "<"} ${max}${unit}`;
  if (min !== null) return `${range.minInclusive ? "≥" : ">"} ${min}${unit}`;
  return range.text;
}

type Selection = {
  ranges: StandardizedRange[];
  missingContext: "age" | "sex" | null;
};

/** Keeps only the most demographically specific ranges that apply. */
function selectApplicable(
  ranges: StandardizedRange[],
  patient: PatientContext,
): Selection {
  const usable = ranges.filter(hasBound);
  const applicable: Array<{ range: StandardizedRange; specificity: number }> = [];
  let missingContext: "age" | "sex" | null = null;

  for (const range of usable) {
    const result = evaluateApplicability(range, patient);
    if (result.kind === "applicable") {
      applicable.push({ range, specificity: result.specificity });
    } else if (result.kind === "unknown_context" && missingContext === null) {
      missingContext = result.missing;
    }
  }

  if (applicable.length === 0) return { ranges: [], missingContext };

  const best = Math.max(...applicable.map((entry) => entry.specificity));
  return {
    ranges: applicable
      .filter((entry) => entry.specificity === best)
      .map((entry) => entry.range),
    // A demographic range we could not evaluate only matters when it could have
    // overridden a less specific range that did apply.
    missingContext: missingContext !== null && best === 0 ? missingContext : null,
  };
}

/**
 * A value/range unit mismatch means the comparison would be meaningless. Ranges
 * frequently omit the unit (the report states it once next to the value), which
 * is treated as "same unit as the value" rather than as a conflict.
 */
function hasUnitConflict(
  valueUnit: string | null,
  ranges: StandardizedRange[],
): boolean {
  return ranges.some(
    (range) =>
      range.standardizedUnit !== null &&
      valueUnit !== null &&
      range.standardizedUnit !== valueUnit,
  );
}

export function classifyBiomarker(input: ClassificationInput): ClassificationOutput {
  const { standardizedValue: value, patient } = input;

  if (value === null) {
    return {
      status: "needs_review",
      reason: `Result "${input.originalValue}" is not a single numeric value, so it cannot be compared against a numeric range automatically.`,
      appliedReferenceRange: null,
      appliedOptimalRange: null,
    };
  }

  const allRanges = [...input.referenceRanges, ...input.optimalRanges];

  if (hasUnitConflict(input.standardizedUnit, allRanges)) {
    return {
      status: "needs_review",
      reason:
        "The unit of the result and the unit of the reference range do not match after standardization, so no safe comparison is possible.",
      appliedReferenceRange: null,
      appliedOptimalRange: null,
    };
  }

  const reference = selectApplicable(input.referenceRanges, patient);
  const optimal = selectApplicable(input.optimalRanges, patient);

  if (reference.ranges.length === 0 && optimal.ranges.length === 0) {
    const missing = reference.missingContext ?? optimal.missingContext;
    if (missing) {
      return {
        status: "needs_review",
        reason: `The report scopes this range by ${missing}, but the ${missing} of the patient could not be read from the report.`,
        appliedReferenceRange: null,
        appliedOptimalRange: null,
      };
    }
    return {
      status: "needs_review",
      reason: "The report does not print a usable reference range for this biomarker.",
      appliedReferenceRange: null,
      appliedOptimalRange: null,
    };
  }

  if (reference.missingContext !== null || optimal.missingContext !== null) {
    const missing = reference.missingContext ?? optimal.missingContext;
    return {
      status: "needs_review",
      reason: `The report prints ${missing}-specific ranges for this biomarker, but the ${missing} of the patient could not be read, so the applicable range is ambiguous.`,
      appliedReferenceRange: null,
      appliedOptimalRange: null,
    };
  }

  const referenceRange = pickSingle(reference.ranges, value);
  const optimalRange = pickSingle(optimal.ranges, value);

  if (referenceRange === "ambiguous" || optimalRange === "ambiguous") {
    return {
      status: "needs_review",
      reason:
        "Several equally specific ranges apply to this biomarker and they disagree about the result, so the classification is ambiguous.",
      appliedReferenceRange: null,
      appliedOptimalRange: null,
    };
  }

  if (optimalRange && isWithinRange(value, optimalRange)) {
    return {
      status: "optimal",
      reason: `${value}${unitSuffix(input.standardizedUnit)} falls inside the optimal range printed on the report (${formatRange(optimalRange)}).`,
      appliedReferenceRange: referenceRange,
      appliedOptimalRange: optimalRange,
    };
  }

  if (referenceRange === null) {
    return {
      status: "needs_review",
      reason:
        "Only an optimal range is printed for this biomarker and the result falls outside it. Without a reference range the result cannot be classified as normal or out of range.",
      appliedReferenceRange: null,
      appliedOptimalRange: optimalRange,
    };
  }

  if (isWithinRange(value, referenceRange)) {
    const optimalNote = optimalRange
      ? ` It is outside the printed optimal range (${formatRange(optimalRange)}).`
      : "";
    return {
      status: "normal",
      reason: `${value}${unitSuffix(input.standardizedUnit)} falls inside the reference range printed on the report (${formatRange(referenceRange)}).${optimalNote}`,
      appliedReferenceRange: referenceRange,
      appliedOptimalRange: optimalRange,
    };
  }

  const direction =
    referenceRange.standardizedMax !== null && value > referenceRange.standardizedMax
      ? "above"
      : "below";

  return {
    status: "out_of_range",
    reason: `${value}${unitSuffix(input.standardizedUnit)} is ${direction} the reference range printed on the report (${formatRange(referenceRange)}).`,
    appliedReferenceRange: referenceRange,
    appliedOptimalRange: optimalRange,
  };
}

/**
 * Returns the single range to apply. When several equally specific ranges apply
 * they must agree about this value, otherwise the result is ambiguous.
 */
function pickSingle(
  ranges: StandardizedRange[],
  value: number,
): StandardizedRange | null | "ambiguous" {
  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];

  const verdicts = new Set(ranges.map((range) => isWithinRange(value, range)));
  if (verdicts.size > 1) return "ambiguous";
  return ranges[0];
}

function unitSuffix(unit: string | null): string {
  return unit ? ` ${unit}` : "";
}
