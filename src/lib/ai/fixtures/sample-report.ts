import type { RawExtraction, RawRange } from "@/lib/domain/schemas";

/**
 * Demo fixture, transcribed by hand from the sample report supplied with the
 * challenge and from nothing else. It is the exact shape a real provider must
 * return, so the deterministic pipeline behind it is exercised end to end.
 *
 * Note on the lipid panel: the report prints cardiovascular-risk target values
 * under "Colesterol no HDL" and "Colesterol LDL" and explicitly calls them
 * recommended values, so they are transcribed as optimal ranges. The report does
 * not assign a risk category to this patient, which is exactly the ambiguity the
 * classifier is designed to surface rather than resolve.
 */

function range(
  text: string,
  min: number | null,
  max: number | null,
  options: { minInclusive?: boolean; maxInclusive?: boolean; unit?: string | null } = {},
): RawRange {
  return {
    text,
    min,
    max,
    minInclusive: options.minInclusive ?? true,
    maxInclusive: options.maxInclusive ?? true,
    unit: options.unit ?? null,
    appliesToSex: null,
    appliesToAgeMinYears: null,
    appliesToAgeMaxYears: null,
  };
}

/** Closed interval printed as `[ a - b ]`. */
function closed(min: number, max: number): RawRange {
  return range(`[ ${format(min)} - ${format(max)} ]`, min, max);
}

/** Strict upper bound printed as `[ < x ]`. */
function below(max: number): RawRange {
  return range(`[ < ${format(max)} ]`, null, max, { maxInclusive: false });
}

/** Strict lower bound printed as `[ > x ]`. */
function above(min: number): RawRange {
  return range(`[ > ${format(min)} ]`, min, null, { minInclusive: false });
}

function format(value: number): string {
  return value.toString().replace(".", ",");
}

type FixtureRow = {
  name: string;
  panel: string;
  value: string;
  numeric: number | null;
  unit: string | null;
  reference?: RawRange[];
  optimal?: RawRange[];
  page: number;
  confidence?: number;
  notes?: string;
};

const ROWS: FixtureRow[] = [
  // ---- Page 1: Hemograma -------------------------------------------------
  { name: "Hematíes", panel: "Hemograma · Serie eritrocitaria", value: "4,73", numeric: 4.73, unit: "x10⁶/mm³", reference: [closed(4.1, 5.75)], page: 1 },
  { name: "Hemoglobina", panel: "Hemograma · Serie eritrocitaria", value: "13,9", numeric: 13.9, unit: "g/dL", reference: [closed(12.5, 17.2)], page: 1 },
  { name: "Hematocrito", panel: "Hemograma · Serie eritrocitaria", value: "42,6", numeric: 42.6, unit: "%", reference: [closed(36.5, 50.5)], page: 1 },
  { name: "Volumen corpuscular medio (VCM)", panel: "Hemograma · Serie eritrocitaria", value: "90", numeric: 90, unit: "fL", reference: [closed(78, 99)], page: 1 },
  { name: "Hemoglobina corpuscular media (HCM)", panel: "Hemograma · Serie eritrocitaria", value: "29,5", numeric: 29.5, unit: "pg", reference: [closed(26, 33.5)], page: 1 },
  { name: "Conc. de hgb. corpuscular media (CHCM)", panel: "Hemograma · Serie eritrocitaria", value: "32,7", numeric: 32.7, unit: "g/dL", reference: [closed(31.5, 36)], page: 1 },
  { name: "Indice de anisocitosis (RDW)", panel: "Hemograma · Serie eritrocitaria", value: "13,0", numeric: 13, unit: "%", reference: [closed(11.5, 15.5)], page: 1 },

  { name: "Leucocitos", panel: "Hemograma · Serie leucocitaria", value: "4,3", numeric: 4.3, unit: "x10³/mm³", reference: [closed(3.9, 10.5)], page: 1 },
  { name: "Neutrófilos %", panel: "Hemograma · Serie leucocitaria", value: "50,8", numeric: 50.8, unit: "%", reference: [closed(42, 77)], page: 1 },
  { name: "Linfocitos %", panel: "Hemograma · Serie leucocitaria", value: "36,2", numeric: 36.2, unit: "%", reference: [closed(20, 44)], page: 1 },
  { name: "Monocitos %", panel: "Hemograma · Serie leucocitaria", value: "7,3", numeric: 7.3, unit: "%", reference: [closed(1.5, 11.6)], page: 1 },
  { name: "Eosinófilos %", panel: "Hemograma · Serie leucocitaria", value: "4,6", numeric: 4.6, unit: "%", reference: [closed(0.5, 5.5)], page: 1 },
  { name: "Basófilos %", panel: "Hemograma · Serie leucocitaria", value: "1,1", numeric: 1.1, unit: "%", reference: [closed(0, 1.75)], page: 1 },
  { name: "Neutrófilos", panel: "Hemograma · Serie leucocitaria", value: "2,2", numeric: 2.2, unit: "x10³/mm³", reference: [closed(1.5, 7.7)], page: 1 },
  { name: "Linfocitos", panel: "Hemograma · Serie leucocitaria", value: "1,6", numeric: 1.6, unit: "x10³/mm³", reference: [closed(1.1, 4.5)], page: 1 },
  { name: "Monocitos", panel: "Hemograma · Serie leucocitaria", value: "0,3", numeric: 0.3, unit: "x10³/mm³", reference: [closed(0.1, 0.95)], page: 1 },
  { name: "Eosinófilos", panel: "Hemograma · Serie leucocitaria", value: "0,2", numeric: 0.2, unit: "x10³/mm³", reference: [closed(0.02, 0.5)], page: 1 },
  { name: "Basófilos", panel: "Hemograma · Serie leucocitaria", value: "0,0", numeric: 0, unit: "x10³/mm³", reference: [closed(0, 0.2)], page: 1 },

  { name: "Plaquetas", panel: "Hemograma · Serie plaquetaria", value: "233", numeric: 233, unit: "x10³/mm³", reference: [closed(150, 370)], page: 1 },
  { name: "Volumen plaquetario medio (VPM)", panel: "Hemograma · Serie plaquetaria", value: "11,6", numeric: 11.6, unit: "fL", reference: [closed(7, 12)], page: 1 },

  // Qualitative results: no numeric value and no printed range.
  { name: "Grupo sanguíneo", panel: "Inmunohematología", value: "A", numeric: null, unit: null, page: 1, confidence: 0.97 },
  { name: "Factor Rh (D)", panel: "Inmunohematología", value: "Positivo", numeric: null, unit: null, page: 1, confidence: 0.97 },

  // ---- Page 2: Bioquímica ------------------------------------------------
  { name: "Glucosa (suero/plasma)", panel: "Metabolismo hidrocarbonado (suero/plasma)", value: "99", numeric: 99, unit: "mg/dL", reference: [closed(74, 106)], page: 2 },
  {
    name: "Hemoglobina A1c (NGSP) por HPLC",
    panel: "Metabolismo hidrocarbonado (sangre EDTA)",
    value: "4,7",
    numeric: 4.7,
    unit: "%",
    reference: [below(5.7)],
    page: 2,
    notes: "Se consideran normales los niveles de HbA1c inferiores a 5,7% (<39 mmol/mol). Valores entre 5,7 - 6,4% (39 a 47 mmol/mol) se consideran criterio de prediabetes. Valores superiores o igual a 6,5% (48 mmol/mol) se consideran diagnósticos de diabetes mellitus. (Criterios de la ADA, 2024).",
  },
  { name: "Hemoglobina A1c (IFCC) por HPLC", panel: "Metabolismo hidrocarbonado (sangre EDTA)", value: "28", numeric: 28, unit: "mmol/mol", reference: [below(39)], page: 2 },

  { name: "Colesterol total", panel: "Metabolismo lipoproteíco (suero)", value: "209", numeric: 209, unit: "mg/dL", reference: [below(200)], page: 2 },
  { name: "Colesterol HDL", panel: "Metabolismo lipoproteíco (suero)", value: "49", numeric: 49, unit: "mg/dL", reference: [above(40)], page: 2 },
  {
    name: "Colesterol no HDL",
    panel: "Metabolismo lipoproteíco (suero)",
    value: "160",
    numeric: 160,
    unit: "mg/dL",
    reference: [below(130)],
    optimal: [
      range("Prevención secundaria y RCV muy alto: < 85 mg/dL", null, 85, { maxInclusive: false, unit: "mg/dL" }),
      range("RCV Alto: < 100 mg/dL", null, 100, { maxInclusive: false, unit: "mg/dL" }),
      range("RCV Moderado: < 130 mg/dL", null, 130, { maxInclusive: false, unit: "mg/dL" }),
    ],
    page: 2,
    notes: "Valores de Colesterol no HDL recomendados según el riesgo cardiovascular del paciente.",
  },
  {
    name: "Colesterol LDL",
    panel: "Metabolismo lipoproteíco (suero)",
    value: "149",
    numeric: 149,
    unit: "mg/dL",
    reference: [below(116)],
    optimal: [
      range("Prevención secundaria y RCV muy alto: < 55 mg/dL", null, 55, { maxInclusive: false, unit: "mg/dL" }),
      range("RCV Alto: < 70 mg/dL", null, 70, { maxInclusive: false, unit: "mg/dL" }),
      range("RCV Moderado: < 100 mg/dL", null, 100, { maxInclusive: false, unit: "mg/dL" }),
      range("RCV bajo: < 116 mg/dL", null, 116, { maxInclusive: false, unit: "mg/dL" }),
    ],
    page: 2,
    notes: "Valores de Colesterol LDL recomendados según el riesgo cardiovascular del paciente.",
  },
  { name: "Triglicéridos", panel: "Metabolismo lipoproteíco (suero)", value: "60", numeric: 60, unit: "mg/dL", reference: [below(150)], page: 2 },
  { name: "Lipoproteina (a)", panel: "Metabolismo lipoproteíco (suero)", value: "4,6", numeric: 4.6, unit: "mg/dL", reference: [below(30)], page: 2 },
  { name: "Apolipoproteína B", panel: "Metabolismo lipoproteíco (suero)", value: "93", numeric: 93, unit: "mg/dL", reference: [closed(60, 140)], page: 2 },

  { name: "Proteínas totales", panel: "Proteínas (suero)", value: "68", numeric: 68, unit: "g/L", reference: [closed(64, 83)], page: 2 },
  { name: "Albúmina", panel: "Proteínas (suero)", value: "39", numeric: 39, unit: "g/L", reference: [closed(35, 52)], page: 2 },
  // Censored result: the analyser reported below its limit of quantification.
  { name: "Proteína C Reactiva en suero", panel: "Proteínas (suero)", value: "<0,2", numeric: null, unit: "mg/L", reference: [below(5)], page: 2, confidence: 0.95 },

  { name: "Urato", panel: "Pruebas de función renal (suero)", value: "4,2", numeric: 4.2, unit: "mg/dL", reference: [closed(3.6, 7.7)], page: 2 },
  { name: "Creatinina", panel: "Pruebas de función renal (suero)", value: "0,82", numeric: 0.82, unit: "mg/dL", reference: [closed(0.67, 1.17)], page: 2 },
];

export const SAMPLE_REPORT_EXTRACTION: RawExtraction = {
  reportLanguage: "es",
  patient: {
    // The report prints a date of birth, not an age. Age is derived in TypeScript.
    ageYears: null,
    dateOfBirth: "1978-02-13",
    sex: "male",
    reportDate: "2026-02-23",
    collectionDate: null,
    laboratoryName: "SNB Diagnósticos Globales",
    reportId: "V6838501",
  },
  biomarkers: ROWS.map((row) => ({
    originalName: row.name,
    standardizedNameSuggestion: null,
    panel: row.panel,
    originalValue: row.value,
    numericValue: row.numeric,
    originalUnit: row.unit,
    referenceRanges: row.reference ?? [],
    optimalRanges: row.optimal ?? [],
    sourcePage: row.page,
    confidence: row.confidence ?? 0.99,
    notes: row.notes ?? null,
  })),
};
