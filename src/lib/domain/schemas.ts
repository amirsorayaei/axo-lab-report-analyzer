import { z } from "zod";

/**
 * `RawExtraction*` is pure transcription of what the report prints; the model is
 * never asked for a status, a converted value or a threshold. `Analysis*` is
 * computed from it in TypeScript. Keeping the layers apart is what stops the
 * model influencing a status except through the facts it transcribed.
 */

export const SexSchema = z.enum(["male", "female"]);
export type Sex = z.infer<typeof SexSchema>;

/** A single printed range, e.g. `[ 4,1 - 5,75 ]`, `[ < 200 ]`, `[ > 40 ]`. */
export const RawRangeSchema = z.object({
  /** Exactly as printed, for display and auditing. */
  text: z.string().min(1),
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** `false` only for a strict `<` / `>` printed on the report. */
  minInclusive: z.boolean(),
  maxInclusive: z.boolean(),
  unit: z.string().nullable(),
  // Set only where the report explicitly scopes the range; null means it
  // applies to everyone, never "unknown".
  appliesToSex: SexSchema.nullable(),
  appliesToAgeMinYears: z.number().nullable(),
  appliesToAgeMaxYears: z.number().nullable(),
});
export type RawRange = z.infer<typeof RawRangeSchema>;

export const RawBiomarkerSchema = z.object({
  originalName: z.string().min(1),
  /** Fallback only; the TS dictionary takes precedence. */
  standardizedNameSuggestion: z.string().nullable(),
  panel: z.string().nullable(),
  /** Exactly as printed, including `<`, `>` and non-numeric results. */
  originalValue: z.string().min(1),
  /** Null for qualitative or censored values, which cannot be compared. */
  numericValue: z.number().nullable(),
  originalUnit: z.string().nullable(),
  referenceRanges: z.array(RawRangeSchema),
  optimalRanges: z.array(RawRangeSchema),
  /** 1-based page the result was read from. */
  sourcePage: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});
export type RawBiomarker = z.infer<typeof RawBiomarkerSchema>;

export const RawPatientSchema = z.object({
  ageYears: z.number().int().min(0).max(130).nullable(),
  /** ISO `YYYY-MM-DD`. */
  dateOfBirth: z.string().nullable(),
  sex: SexSchema.nullable(),
  /** ISO `YYYY-MM-DD`. Reference date for deriving age. */
  reportDate: z.string().nullable(),
  collectionDate: z.string().nullable(),
  laboratoryName: z.string().nullable(),
  reportId: z.string().nullable(),
  /**
   * The model's only channel for reporting that the sources are not one report
   * for one patient — set when they name clearly different people.
   */
  conflictingSources: z.boolean(),
});
export type RawPatient = z.infer<typeof RawPatientSchema>;

export const RawExtractionSchema = z.object({
  patient: RawPatientSchema,
  biomarkers: z.array(RawBiomarkerSchema),
  /** ISO 639-1, when identifiable. */
  reportLanguage: z.string().nullable(),
});
export type RawExtraction = z.infer<typeof RawExtractionSchema>;

// Deterministic analysis output

export const BIOMARKER_STATUSES = [
  "optimal",
  "normal",
  "out_of_range",
  "needs_review",
] as const;
export type BiomarkerStatus = (typeof BIOMARKER_STATUSES)[number];

export type StandardizedRange = RawRange & {
  /** Bounds after the unit-standardization factor. */
  standardizedMin: number | null;
  standardizedMax: number | null;
  standardizedUnit: string | null;
};

export type AnalyzedBiomarker = {
  id: string;
  originalName: string;
  standardizedName: string;
  /** Surfaced in the UI so a renamed biomarker is traceable. */
  nameSource: "dictionary" | "model" | "original";
  panel: string | null;
  originalValue: string;
  numericValue: number | null;
  /** `numericValue` expressed in `standardizedUnit`. */
  standardizedValue: number | null;
  originalUnit: string | null;
  standardizedUnit: string | null;
  /** True only when the magnitude actually changed. */
  conversionApplied: boolean;
  referenceRanges: StandardizedRange[];
  optimalRanges: StandardizedRange[];
  /** The range the status was actually decided against. */
  appliedReferenceRange: StandardizedRange | null;
  appliedOptimalRange: StandardizedRange | null;
  status: BiomarkerStatus;
  classificationReason: string;
  confidence: number;
  sourcePage: number;
  notes: string | null;
};

export type ReportSourceSummary = {
  fileCount: number;
  pdfCount: number;
  imageCount: number;
  pdfPageCount: number;
  sourceTypes: Array<"text" | "image">;
  files: Array<{
    sourceIndex: number;
    fileName: string;
    kind: "text" | "image";
    pageCount: number | null;
  }>;
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
  /** `derived_from_dob` ages are computed in TypeScript, never by the model. */
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
  /** Total pages across every uploaded PDF. */
  pageCount: number;
  sources: ReportSourceSummary;
  biomarkers: AnalyzedBiomarker[];
  summary: AnalysisSummary;
  /** `mock` renders the demo-mode banner; results must never look live. */
  providerMode: "mock" | "live";
  providerLabel: string;
};
