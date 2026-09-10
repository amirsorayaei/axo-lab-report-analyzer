import { z } from "zod";

/**
 * Two schema layers:
 *
 * 1. `RawExtraction*` — what the AI provider is allowed to return. It is pure
 *    transcription of what is printed on the report: original names, original
 *    values, original units, printed ranges. The model is never asked for a
 *    status, a converted value or a threshold.
 * 2. `Analysis*` — the deterministic output produced in TypeScript from the raw
 *    extraction (name standardization, unit standardization, classification).
 *
 * Keeping the layers separate is what makes classification auditable: the model
 * cannot influence a status except through the facts it transcribed.
 */

export const SexSchema = z.enum(["male", "female"]);
export type Sex = z.infer<typeof SexSchema>;

/** A single printed range, e.g. `[ 4,1 - 5,75 ]`, `[ < 200 ]`, `[ > 40 ]`. */
export const RawRangeSchema = z.object({
  /** Range exactly as printed on the report. Used for display and auditing. */
  text: z.string().min(1),
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** `false` only when the report prints a strict `<` / `>` comparison. */
  minInclusive: z.boolean(),
  maxInclusive: z.boolean(),
  /** Unit the bounds are expressed in, when the report states one separately. */
  unit: z.string().nullable(),
  /** Set only when the report explicitly scopes the range to one sex. */
  appliesToSex: SexSchema.nullable(),
  /** Set only when the report explicitly scopes the range to an age window. */
  appliesToAgeMinYears: z.number().nullable(),
  appliesToAgeMaxYears: z.number().nullable(),
});
export type RawRange = z.infer<typeof RawRangeSchema>;

export const RawBiomarkerSchema = z.object({
  originalName: z.string().min(1),
  /** Model's English suggestion. The TS dictionary takes precedence over it. */
  standardizedNameSuggestion: z.string().nullable(),
  /** Section heading on the report, e.g. "Metabolismo lipoproteíco (suero)". */
  panel: z.string().nullable(),
  /** Result exactly as printed, including `<`, `>` or non-numeric results. */
  originalValue: z.string().min(1),
  /** Parsed number when the printed value is numeric, otherwise null. */
  numericValue: z.number().nullable(),
  originalUnit: z.string().nullable(),
  referenceRanges: z.array(RawRangeSchema),
  optimalRanges: z.array(RawRangeSchema),
  /** 1-based page the result was read from. */
  sourcePage: z.number().int().positive(),
  /** Model's self-reported transcription confidence. */
  confidence: z.number().min(0).max(1),
  /** Report footnotes attached to this result, verbatim. */
  notes: z.string().nullable(),
});
export type RawBiomarker = z.infer<typeof RawBiomarkerSchema>;

export const RawPatientSchema = z.object({
  ageYears: z.number().int().min(0).max(130).nullable(),
  /** ISO `YYYY-MM-DD` when a date of birth is printed. */
  dateOfBirth: z.string().nullable(),
  sex: SexSchema.nullable(),
  /** ISO `YYYY-MM-DD`. Used to derive age from date of birth. */
  reportDate: z.string().nullable(),
  collectionDate: z.string().nullable(),
  laboratoryName: z.string().nullable(),
  reportId: z.string().nullable(),
});
export type RawPatient = z.infer<typeof RawPatientSchema>;

export const RawExtractionSchema = z.object({
  patient: RawPatientSchema,
  biomarkers: z.array(RawBiomarkerSchema),
  /** Detected report language as an ISO 639-1 code, when identifiable. */
  reportLanguage: z.string().nullable(),
});
export type RawExtraction = z.infer<typeof RawExtractionSchema>;

// ---------------------------------------------------------------------------
// Deterministic analysis output
// ---------------------------------------------------------------------------

export const BIOMARKER_STATUSES = [
  "optimal",
  "normal",
  "out_of_range",
  "needs_review",
] as const;
export type BiomarkerStatus = (typeof BIOMARKER_STATUSES)[number];

export type StandardizedRange = RawRange & {
  /** Bounds after applying the unit-standardization factor. */
  standardizedMin: number | null;
  standardizedMax: number | null;
  standardizedUnit: string | null;
};

export type AnalyzedBiomarker = {
  id: string;
  originalName: string;
  standardizedName: string;
  /** Where `standardizedName` came from, for transparency in the UI. */
  nameSource: "dictionary" | "model" | "original";
  panel: string | null;
  originalValue: string;
  numericValue: number | null;
  /** `numericValue` expressed in `standardizedUnit`. */
  standardizedValue: number | null;
  originalUnit: string | null;
  standardizedUnit: string | null;
  /** True only when the unit change altered the magnitude of the value. */
  conversionApplied: boolean;
  referenceRanges: StandardizedRange[];
  optimalRanges: StandardizedRange[];
  /** The range actually used to decide the status, if any. */
  appliedReferenceRange: StandardizedRange | null;
  appliedOptimalRange: StandardizedRange | null;
  status: BiomarkerStatus;
  classificationReason: string;
  confidence: number;
  sourcePage: number;
  notes: string | null;
};

export type AnalysisSummary = {
  total: number;
  optimal: number;
  normal: number;
  outOfRange: number;
  needsReview: number;
};

export type PatientSummary = {
  ageYears: number | null;
  /** How age was obtained — derived ages are computed in TypeScript. */
  ageSource: "reported" | "derived_from_dob" | "unknown";
  sex: Sex | null;
  reportDate: string | null;
  collectionDate: string | null;
  laboratoryName: string | null;
  reportId: string | null;
};

export type AnalysisResult = {
  patient: PatientSummary;
  reportLanguage: string | null;
  pageCount: number;
  biomarkers: AnalyzedBiomarker[];
  summary: AnalysisSummary;
  /** `mock` renders a prominent demo-mode banner in the UI. */
  providerMode: "mock" | "live";
  providerLabel: string;
};
