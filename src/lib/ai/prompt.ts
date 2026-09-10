import "server-only";

import type { PdfPage } from "@/lib/pdf/extract";

/**
 * The model has exactly one job: transcribe what is printed. Anything that could
 * be decided deterministically (status, unit conversion, age arithmetic) is kept
 * out of the prompt on purpose.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You extract laboratory results from the plain text of a laboratory report.

You are a transcription tool, not a clinician.

Rules:
1. Return every biomarker result that appears in the report, including haematology, chemistry, lipids, hormones, vitamins and qualitative results such as blood group.
2. Preserve the original biomarker name, the original printed value and the original unit exactly as they appear, including the decimal separator used by the report.
3. Also set "numericValue" when the printed value is a plain number. Convert a decimal comma to a decimal point for this field only. If the value is qualitative ("Positivo", "A") or censored ("<0,2"), set "numericValue" to null.
4. Copy reference ranges only from the report. Never add, complete, widen or infer a range. "[ 4,1 - 5,75 ]" has min 4.1 and max 5.75, both inclusive. "[ < 200 ]" has min null, max 200 and maxInclusive false. "[ > 40 ]" has min 40, max null and minInclusive false. "[ <= 5 ]" is inclusive.
5. Put a range in "optimalRanges" only when the report explicitly labels it as optimal, desirable, target or recommended. Everything else belongs in "referenceRanges". If unsure, use "referenceRanges".
6. Set "appliesToSex", "appliesToAgeMinYears" and "appliesToAgeMaxYears" only when the report explicitly scopes a range to that sex or age band. Otherwise use null.
7. Use null for any fact the report does not state. Never guess a value, unit, range, age or sex.
8. "sourcePage" is the page marker the text was found under.
9. "standardizedNameSuggestion" is an English translation of the biomarker name, or null if you are unsure.
10. "confidence" is your transcription confidence between 0 and 1, based only on how legible and unambiguous the text was.
11. Do not give medical advice, interpretation, diagnosis or recommendations anywhere in the output.
12. Respond with JSON only, matching the requested schema exactly. No prose, no markdown fences.`;

export function buildExtractionUserPrompt(pages: PdfPage[]): string {
  const body = pages
    .map((page) => `===== PAGE ${page.pageNumber} =====\n${page.text}`)
    .join("\n\n");

  return `Extract all laboratory results from the report text below.\n\n${body}`;
}

/**
 * JSON Schema mirror of `RawExtractionSchema`, sent to providers that support
 * structured output. The Zod schema remains the authority: whatever comes back
 * is validated against it regardless of what the provider promised.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patient", "biomarkers", "reportLanguage"],
  properties: {
    reportLanguage: { type: ["string", "null"] },
    patient: {
      type: "object",
      additionalProperties: false,
      required: [
        "ageYears",
        "dateOfBirth",
        "sex",
        "reportDate",
        "collectionDate",
        "laboratoryName",
        "reportId",
      ],
      properties: {
        ageYears: { type: ["integer", "null"] },
        dateOfBirth: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        sex: { type: ["string", "null"], enum: ["male", "female", null] },
        reportDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        collectionDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        laboratoryName: { type: ["string", "null"] },
        reportId: { type: ["string", "null"] },
      },
    },
    biomarkers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "originalName",
          "standardizedNameSuggestion",
          "panel",
          "originalValue",
          "numericValue",
          "originalUnit",
          "referenceRanges",
          "optimalRanges",
          "sourcePage",
          "confidence",
          "notes",
        ],
        properties: {
          originalName: { type: "string" },
          standardizedNameSuggestion: { type: ["string", "null"] },
          panel: { type: ["string", "null"] },
          originalValue: { type: "string" },
          numericValue: { type: ["number", "null"] },
          originalUnit: { type: ["string", "null"] },
          referenceRanges: { type: "array", items: { $ref: "#/$defs/range" } },
          optimalRanges: { type: "array", items: { $ref: "#/$defs/range" } },
          sourcePage: { type: "integer" },
          confidence: { type: "number" },
          notes: { type: ["string", "null"] },
        },
      },
    },
  },
  $defs: {
    range: {
      type: "object",
      additionalProperties: false,
      required: [
        "text",
        "min",
        "max",
        "minInclusive",
        "maxInclusive",
        "unit",
        "appliesToSex",
        "appliesToAgeMinYears",
        "appliesToAgeMaxYears",
      ],
      properties: {
        text: { type: "string" },
        min: { type: ["number", "null"] },
        max: { type: ["number", "null"] },
        minInclusive: { type: "boolean" },
        maxInclusive: { type: "boolean" },
        unit: { type: ["string", "null"] },
        appliesToSex: { type: ["string", "null"], enum: ["male", "female", null] },
        appliesToAgeMinYears: { type: ["number", "null"] },
        appliesToAgeMaxYears: { type: ["number", "null"] },
      },
    },
  },
} as const;
