/**
 * The dictionary is authoritative; the model's suggestion is only a fallback.
 * The UI always shows the original name too, so nothing is silently rewritten.
 */

export type NameStandardization = {
  standardizedName: string;
  source: "dictionary" | "model" | "original";
};

/** `%` is kept: it distinguishes e.g. Neutrophils % from the absolute count. */
export function normalizeNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drops the assay method a lab appends, e.g. "por HPLC", "by ELISA". */
function stripMethod(name: string): string {
  return name.replace(/\b(por|by|mediante|method|metodo|m\u00e9todo)\s+[\w.\-]+/gi, " ");
}

/** Drops specimen and method qualifiers, e.g. "(suero/plasma)", "en suero". */
function stripQualifiers(name: string): string {
  return stripMethod(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(en\s+)?(suero|plasma|sangre|orina|serum|blood|urine)\b/gi, " ");
}

const DICTIONARY: Record<string, string> = {
  // Red cell series
  "hematies": "Red Blood Cells (RBC)",
  "eritrocitos": "Red Blood Cells (RBC)",
  "red blood cells": "Red Blood Cells (RBC)",
  "rbc": "Red Blood Cells (RBC)",
  "hemoglobina": "Hemoglobin",
  "hemoglobin": "Hemoglobin",
  "hematocrito": "Hematocrit",
  "hematocrit": "Hematocrit",
  "volumen corpuscular medio vcm": "Mean Corpuscular Volume (MCV)",
  "vcm": "Mean Corpuscular Volume (MCV)",
  "mcv": "Mean Corpuscular Volume (MCV)",
  "hemoglobina corpuscular media hcm": "Mean Corpuscular Hemoglobin (MCH)",
  "hcm": "Mean Corpuscular Hemoglobin (MCH)",
  "mch": "Mean Corpuscular Hemoglobin (MCH)",
  "conc de hgb corpuscular media chcm": "Mean Corpuscular Hemoglobin Concentration (MCHC)",
  "concentracion de hemoglobina corpuscular media chcm":
    "Mean Corpuscular Hemoglobin Concentration (MCHC)",
  "chcm": "Mean Corpuscular Hemoglobin Concentration (MCHC)",
  "mchc": "Mean Corpuscular Hemoglobin Concentration (MCHC)",
  "indice de anisocitosis rdw": "Red Cell Distribution Width (RDW)",
  "rdw": "Red Cell Distribution Width (RDW)",
  "reticulocitos": "Reticulocytes",

  // White cell series
  "leucocitos": "White Blood Cells (WBC)",
  "white blood cells": "White Blood Cells (WBC)",
  "wbc": "White Blood Cells (WBC)",
  "neutrofilos": "Neutrophils (absolute)",
  "neutrofilos %": "Neutrophils (%)",
  "neutrophils": "Neutrophils (absolute)",
  "linfocitos": "Lymphocytes (absolute)",
  "linfocitos %": "Lymphocytes (%)",
  "lymphocytes": "Lymphocytes (absolute)",
  "monocitos": "Monocytes (absolute)",
  "monocitos %": "Monocytes (%)",
  "monocytes": "Monocytes (absolute)",
  "eosinofilos": "Eosinophils (absolute)",
  "eosinofilos %": "Eosinophils (%)",
  "eosinophils": "Eosinophils (absolute)",
  "basofilos": "Basophils (absolute)",
  "basofilos %": "Basophils (%)",
  "basophils": "Basophils (absolute)",

  // Platelets and blood group
  "plaquetas": "Platelets",
  "platelets": "Platelets",
  "volumen plaquetario medio vpm": "Mean Platelet Volume (MPV)",
  "vpm": "Mean Platelet Volume (MPV)",
  "mpv": "Mean Platelet Volume (MPV)",
  "grupo sanguineo": "Blood Group (ABO)",
  "factor rh d": "Rh Factor (D)",
  "factor rh": "Rh Factor (D)",

  // Carbohydrate metabolism
  "glucosa": "Glucose",
  "glucose": "Glucose",
  "hemoglobina a1c": "Hemoglobin A1c",
  "hemoglobina a1c ngsp": "Hemoglobin A1c (NGSP)",
  "hemoglobina a1c ifcc": "Hemoglobin A1c (IFCC)",
  "hemoglobina glicosilada": "Hemoglobin A1c",
  "hba1c": "Hemoglobin A1c",
  "insulina": "Insulin",
  "peptido c": "C-Peptide",

  // Lipids
  "colesterol total": "Total Cholesterol",
  "total cholesterol": "Total Cholesterol",
  "colesterol hdl": "HDL Cholesterol",
  "hdl": "HDL Cholesterol",
  "colesterol no hdl": "Non-HDL Cholesterol",
  "colesterol ldl": "LDL Cholesterol",
  "ldl": "LDL Cholesterol",
  "trigliceridos": "Triglycerides",
  "triglycerides": "Triglycerides",
  "lipoproteina a": "Lipoprotein(a)",
  "lp a": "Lipoprotein(a)",
  "apolipoproteina b": "Apolipoprotein B",
  "apolipoproteina a1": "Apolipoprotein A1",

  // Proteins and inflammation
  "proteinas totales": "Total Protein",
  "albumina": "Albumin",
  "albumin": "Albumin",
  "proteina c reactiva": "C-Reactive Protein (CRP)",
  "pcr": "C-Reactive Protein (CRP)",
  "c reactive protein": "C-Reactive Protein (CRP)",
  "homocisteina": "Homocysteine",
  "fibrinogeno": "Fibrinogen",
  "velocidad de sedimentacion globular": "Erythrocyte Sedimentation Rate (ESR)",

  // Renal
  "urato": "Uric Acid",
  "acido urico": "Uric Acid",
  "creatinina": "Creatinine",
  "creatinine": "Creatinine",
  "urea": "Urea",
  "nitrogeno ureico": "Blood Urea Nitrogen (BUN)",
  "filtrado glomerular estimado": "Estimated Glomerular Filtration Rate (eGFR)",
  "filtrado glomerular": "Estimated Glomerular Filtration Rate (eGFR)",
  "cistatina c": "Cystatin C",

  // Liver
  "alanina aminotransferasa gpt": "Alanine Aminotransferase (ALT)",
  "gpt": "Alanine Aminotransferase (ALT)",
  "alt": "Alanine Aminotransferase (ALT)",
  "aspartato aminotransferasa got": "Aspartate Aminotransferase (AST)",
  "got": "Aspartate Aminotransferase (AST)",
  "ast": "Aspartate Aminotransferase (AST)",
  "gamma glutamil transferasa": "Gamma-Glutamyl Transferase (GGT)",
  "ggt": "Gamma-Glutamyl Transferase (GGT)",
  "fosfatasa alcalina": "Alkaline Phosphatase (ALP)",
  "bilirrubina total": "Total Bilirubin",
  "bilirrubina directa": "Direct Bilirubin",
  "lactato deshidrogenasa": "Lactate Dehydrogenase (LDH)",

  // Thyroid and hormones
  "tirotropina tsh": "Thyroid Stimulating Hormone (TSH)",
  "tsh": "Thyroid Stimulating Hormone (TSH)",
  "tiroxina libre t4l": "Free Thyroxine (FT4)",
  "t4 libre": "Free Thyroxine (FT4)",
  "t3 libre": "Free Triiodothyronine (FT3)",
  "testosterona total": "Total Testosterone",
  "testosterona": "Total Testosterone",
  "testosterona libre": "Free Testosterone",
  "cortisol": "Cortisol",
  "estradiol": "Estradiol",
  "shbg": "Sex Hormone Binding Globulin (SHBG)",
  "psa total": "Prostate Specific Antigen (PSA)",

  // Vitamins, minerals, iron status
  "vitamina d 25 hidroxi": "Vitamin D (25-OH)",
  "vitamina d": "Vitamin D (25-OH)",
  "vitamina b12": "Vitamin B12",
  "acido folico": "Folate",
  "folato": "Folate",
  "ferritina": "Ferritin",
  "ferritin": "Ferritin",
  "hierro": "Iron",
  "transferrina": "Transferrin",
  "indice de saturacion de transferrina": "Transferrin Saturation",
  "sodio": "Sodium",
  "potasio": "Potassium",
  "cloro": "Chloride",
  "calcio": "Calcium",
  "fosforo": "Phosphorus",
  "magnesio": "Magnesium",
};

export function standardizeBiomarkerName(
  originalName: string,
  modelSuggestion: string | null,
): NameStandardization {
  // Most specific match first: the full printed name, then the name without the
  // assay method, then without specimen qualifiers. This keeps distinctions that
  // matter (NGSP vs IFCC HbA1c) while still matching "Glucosa (suero/plasma)".
  const candidates = [originalName, stripMethod(originalName), stripQualifiers(originalName)];

  for (const candidate of candidates) {
    const hit = DICTIONARY[normalizeNameKey(candidate)];
    if (hit) return { standardizedName: hit, source: "dictionary" };
  }

  if (modelSuggestion && modelSuggestion.trim() !== "") {
    return { standardizedName: modelSuggestion.trim(), source: "model" };
  }

  return { standardizedName: originalName.trim(), source: "original" };
}
