import { classifyBiomarker, type PatientContext } from "@/lib/domain/classify";
import { standardizeBiomarkerName } from "@/lib/domain/biomarker-names";
import { applyFactor, standardizeUnit } from "@/lib/domain/units";
import type {
  AnalysisResult,
  AnalysisSummary,
  AnalyzedBiomarker,
  PatientSummary,
  RawBiomarker,
  RawExtraction,
  RawRange,
  ReportSourceSummary,
  StandardizedRange,
} from "@/lib/domain/schemas";

/**
 * Pure and deterministic: the same extraction always yields the same statuses,
 * whichever provider produced it.
 */
export function analyzeExtraction(
  extraction: RawExtraction,
  meta: {
    sources: ReportSourceSummary;
    providerMode: "mock" | "live";
    providerLabel: string;
  },
): AnalysisResult {
  const patient = buildPatientSummary(extraction);
  const context: PatientContext = { ageYears: patient.ageYears, sex: patient.sex };

  const biomarkers = extraction.biomarkers.map((raw, index) =>
    analyzeBiomarker(raw, index, context),
  );

  return {
    patient,
    reportLanguage: extraction.reportLanguage,
    pageCount: meta.sources.pdfPageCount,
    sources: meta.sources,
    biomarkers,
    summary: summarize(biomarkers),
    providerMode: meta.providerMode,
    providerLabel: meta.providerLabel,
  };
}

function analyzeBiomarker(
  raw: RawBiomarker,
  index: number,
  patient: PatientContext,
): AnalyzedBiomarker {
  const name = standardizeBiomarkerName(raw.originalName, raw.standardizedNameSuggestion);
  const unit = standardizeUnit(raw.originalUnit);

  // Same factor on the value and every bound, so this cannot change a status.
  const standardizedValue = applyFactor(raw.numericValue, unit.factor);
  const referenceRanges = raw.referenceRanges.map((range) =>
    standardizeRange(range, unit.factor, unit.standardizedUnit),
  );
  const optimalRanges = raw.optimalRanges.map((range) =>
    standardizeRange(range, unit.factor, unit.standardizedUnit),
  );

  const classification = classifyBiomarker({
    standardizedValue,
    originalValue: raw.originalValue,
    standardizedUnit: unit.standardizedUnit,
    referenceRanges,
    optimalRanges,
    patient,
  });

  return {
    id: `${index}-${slug(raw.originalName)}`,
    originalName: raw.originalName,
    standardizedName: name.standardizedName,
    nameSource: name.source,
    panel: raw.panel,
    originalValue: raw.originalValue,
    numericValue: raw.numericValue,
    standardizedValue,
    originalUnit: raw.originalUnit,
    standardizedUnit: unit.standardizedUnit,
    conversionApplied: unit.conversionApplied,
    referenceRanges,
    optimalRanges,
    appliedReferenceRange: classification.appliedReferenceRange,
    appliedOptimalRange: classification.appliedOptimalRange,
    status: classification.status,
    classificationReason: classification.reason,
    confidence: raw.confidence,
    sourcePage: raw.sourcePage,
    notes: raw.notes,
  };
}

/** A range printed without a unit is in the unit of the result. */
function standardizeRange(
  range: RawRange,
  factor: number,
  valueUnit: string | null,
): StandardizedRange {
  const own = range.unit ? standardizeUnit(range.unit) : null;
  const rangeFactor = own ? own.factor : factor;

  return {
    ...range,
    standardizedMin: applyFactor(range.min, rangeFactor),
    standardizedMax: applyFactor(range.max, rangeFactor),
    standardizedUnit: own ? own.standardizedUnit : valueUnit,
  };
}

function buildPatientSummary(extraction: RawExtraction): PatientSummary {
  const { patient } = extraction;
  const derived = deriveAgeYears(patient.dateOfBirth, patient.reportDate);

  const ageYears = patient.ageYears ?? derived;
  const ageSource: PatientSummary["ageSource"] =
    patient.ageYears !== null
      ? "reported"
      : derived !== null
        ? "derived_from_dob"
        : "unknown";

  return {
    ageYears,
    ageSource,
    sex: patient.sex,
    reportDate: patient.reportDate,
    collectionDate: patient.collectionDate,
    laboratoryName: patient.laboratoryName,
    reportId: patient.reportId,
  };
}

/** Computed here, not asked of the model: this is arithmetic, not inference. */
export function deriveAgeYears(
  dateOfBirth: string | null,
  referenceDate: string | null,
): number | null {
  if (!dateOfBirth) return null;

  const birth = new Date(dateOfBirth);
  const reference = referenceDate ? new Date(referenceDate) : new Date();
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) return null;
  if (reference < birth) return null;

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = reference.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && reference.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  return age >= 0 && age <= 130 ? age : null;
}

function summarize(biomarkers: AnalyzedBiomarker[]): AnalysisSummary {
  return {
    total: biomarkers.length,
    optimal: biomarkers.filter((b) => b.status === "optimal").length,
    normal: biomarkers.filter((b) => b.status === "normal").length,
    outOfRange: biomarkers.filter((b) => b.status === "out_of_range").length,
    needsReview: biomarkers.filter((b) => b.status === "needs_review").length,
  };
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
