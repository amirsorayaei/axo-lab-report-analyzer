import "server-only";

import type { ReportInput } from "@/lib/upload/report-input";

/**
 * The model has exactly one job: transcribe what is printed. Anything that could
 * be decided deterministically (status, unit conversion, age arithmetic) is kept
 * out of the prompt on purpose.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You extract laboratory results from a laboratory report. The report may be supplied as extracted PDF text, as images of report pages, or as a mixture of both.

You are a transcription tool, not a clinician.

Sources:
A. Every supplied source is a part of ONE report for ONE patient, in the order given. Source 1 comes first, then source 2, and so on.
B. Combine information across all sources. Patient details printed only on source 1 apply to biomarkers found on source 3.
C. Extract every biomarker you can see in every source, whether it came from text or from an image.
D. When reading an image, keep the row and column relationship intact: a value, its unit, its abnormal flag and its reference range belong to the biomarker on the same visual row. Never pair a value with a neighbouring row's range.
E. If two sources overlap and repeat the exact same row — same biomarker, same value, same unit, same reference range, same date — return it once. Do NOT merge or drop repeated biomarkers that differ in value, unit, date or reference range: those are separate results and must all be returned.
F. Never guess anything that is unreadable, cut off, blurred or missing. Omit an unreadable biomarker rather than inventing a plausible one, and use null for any individual fact you cannot read.
G. Set "conflictingSources" to true only when the sources clearly identify DIFFERENT people — a different patient name, document number or date of birth printed on different sources. Ordinary missing details are not a conflict. Otherwise set it to false.

Rules:
1. Return every biomarker result that appears in the report, including haematology, chemistry, lipids, hormones, vitamins and qualitative results such as blood group.
2. Preserve the original biomarker name, the original printed value and the original unit exactly as they appear, including the decimal separator used by the report.
3. Also set "numericValue" when the printed value is a plain number. Convert a decimal comma to a decimal point for this field only. If the value is qualitative ("Positivo", "A") or censored ("<0,2"), set "numericValue" to null.
4. Copy reference ranges only from the report. Never add, complete, widen or infer a range. "[ 4,1 - 5,75 ]" has min 4.1 and max 5.75, both inclusive. "[ < 200 ]" has min null, max 200 and maxInclusive false. "[ > 40 ]" has min 40, max null and minInclusive false. "[ <= 5 ]" is inclusive.
5. Put a range in "optimalRanges" only when the report explicitly labels it as optimal, desirable, target or recommended. Everything else belongs in "referenceRanges". If unsure, use "referenceRanges".
6. Set "appliesToSex", "appliesToAgeMinYears" and "appliesToAgeMaxYears" only when the report explicitly scopes a range to that sex or age band. Otherwise use null.
7. Use null for any fact the report does not state. Never guess a value, unit, range, age or sex. Extract patient age and sex only when they are explicitly printed.
8. "sourcePage" is the page marker the result was found under, exactly as labelled in the source headings below (PDF text blocks carry "PAGE n" and each image carries a page number).
9. "standardizedNameSuggestion" is an English translation of the biomarker name, or null if you are unsure.
10. "confidence" is your transcription confidence between 0 and 1, based only on how legible and unambiguous the text was.
11. Do not give medical advice, interpretation, diagnosis or recommendations anywhere in the output.
12. Respond with JSON only, matching the requested schema exactly. No prose, no markdown fences.`;

/** One entry of an OpenAI-style multimodal `content` array. */
export type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

const LEAD_INSTRUCTION = `The laboratory report below is supplied as ${"{n}"} ordered source(s). Read all of them as one report for one patient, then return the extraction as JSON matching the required schema.`;

/**
 * Builds the ordered multimodal user message.
 *
 * Order is the contract: sources appear in exactly the order the user selected,
 * every block is labelled with its source index and file name, and each image is
 * introduced by a text block immediately before it so the model can attribute a
 * page number to what it is looking at.
 */
export function buildExtractionUserContent(inputs: ReportInput[]): UserContentPart[] {
  const parts: UserContentPart[] = [
    { type: "text", text: LEAD_INSTRUCTION.replace("{n}", String(inputs.length)) },
  ];

  // Page numbers run continuously across every source so `sourcePage` stays a
  // single, unambiguous number in the flat extraction schema.
  let pageCursor = 0;

  for (const input of inputs) {
    if (input.kind === "text") {
      for (const page of input.pages) {
        pageCursor += 1;
        parts.push({
          type: "text",
          text: `===== SOURCE ${input.sourceIndex} — FILE "${input.fileName}" — PDF PAGE ${page.pageNumber} — PAGE ${pageCursor} =====\n${page.text}`,
        });
      }
      continue;
    }

    pageCursor += 1;
    parts.push({
      type: "text",
      text: `===== SOURCE ${input.sourceIndex} — FILE "${input.fileName}" — IMAGE — PAGE ${pageCursor} =====\nThe next image is this page of the report. Read every biomarker row visible in it.`,
    });
    parts.push({ type: "image_url", image_url: { url: input.dataUrl } });
  }

  return parts;
}

/** Plain-text rendering for providers that take a single string. */
export function buildExtractionUserPrompt(inputs: ReportInput[]): string {
  return buildExtractionUserContent(inputs)
    .map((part) => (part.type === "text" ? part.text : "[image omitted]"))
    .join("\n\n");
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
        "conflictingSources",
      ],
      properties: {
        ageYears: { type: ["integer", "null"] },
        dateOfBirth: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        sex: { type: ["string", "null"], enum: ["male", "female", null] },
        reportDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        collectionDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        laboratoryName: { type: ["string", "null"] },
        reportId: { type: ["string", "null"] },
        conflictingSources: { type: "boolean" },
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
