/**
 * Deterministic unit standardization.
 *
 * Design decision: classification is invariant under this step. Every unit maps
 * to a canonical symbol plus a linear factor, and the factor is applied to the
 * value AND to every range bound together. A biomarker therefore never changes
 * status because of a conversion — the conversion exists so the UI can show one
 * consistent unit vocabulary.
 *
 * Most entries are notation aliases with a factor of 1 (`x10³/mm³` and `10^3/µL`
 * are the same quantity, because 1 mm³ = 1 µL). Magnitude-changing factors are
 * limited to rescalings within one mass-concentration family where the target is
 * unambiguously the conventional unit.
 *
 * Two conversions are deliberately NOT implemented:
 *   - molar conversions (mg/dL <-> mmol/L) need an analyte-specific molar mass,
 *     which is medical knowledge this app is not allowed to invent;
 *   - rescalings where both units are conventional for different analytes
 *     (mg/L and mg/dL, g/L and g/dL) would only trade one familiar unit for
 *     another and are left alone.
 * Such units pass through unchanged and stay classifiable against their own
 * printed range.
 */

export type UnitStandardization = {
  /** Canonical symbol used for display. Null when no unit was provided. */
  standardizedUnit: string | null;
  /** Multiply the original value and range bounds by this to reach the unit. */
  factor: number;
  /** True only when `factor !== 1`, i.e. the magnitude actually changed. */
  conversionApplied: boolean;
  /** True when the original unit was recognised by the table. */
  recognized: boolean;
};

type UnitDef = { canonical: string; factor: number };

/**
 * Keys are normalized alias forms (see `normalizeUnitKey`). Factor 1 entries are
 * notation-only aliases: `x10³/mm³` and `10^3/µL` are exactly the same quantity
 * because 1 mm³ = 1 µL.
 */
const UNIT_TABLE: Record<string, UnitDef> = {
  // Counts per volume
  "10^3/mm3": { canonical: "10^3/µL", factor: 1 },
  "10^3/ul": { canonical: "10^3/µL", factor: 1 },
  "k/ul": { canonical: "10^3/µL", factor: 1 },
  "10^9/l": { canonical: "10^3/µL", factor: 1 },
  "10^6/mm3": { canonical: "10^6/µL", factor: 1 },
  "10^6/ul": { canonical: "10^6/µL", factor: 1 },
  "m/ul": { canonical: "10^6/µL", factor: 1 },
  "10^12/l": { canonical: "10^6/µL", factor: 1 },
  "/mm3": { canonical: "/µL", factor: 1 },
  "/ul": { canonical: "/µL", factor: 1 },

  // Mass concentration
  "g/dl": { canonical: "g/dL", factor: 1 },
  "g/l": { canonical: "g/L", factor: 1 },
  "mg/dl": { canonical: "mg/dL", factor: 1 },
  "mg/l": { canonical: "mg/L", factor: 1 },
  "ug/dl": { canonical: "µg/dL", factor: 1 },
  // µg/L and ng/mL are the same quantity, spelled differently.
  "ug/l": { canonical: "ng/mL", factor: 1 },
  "ug/ml": { canonical: "µg/mL", factor: 1 },
  "ng/ml": { canonical: "ng/mL", factor: 1 },
  "ng/dl": { canonical: "ng/mL", factor: 0.01 },
  "ng/l": { canonical: "pg/mL", factor: 1 },
  "pg/ml": { canonical: "pg/mL", factor: 1 },

  // Enzyme and hormone activity
  "u/l": { canonical: "U/L", factor: 1 },
  "ui/l": { canonical: "IU/L", factor: 1 },
  "iu/l": { canonical: "IU/L", factor: 1 },
  "mui/l": { canonical: "mIU/L", factor: 1 },
  "miu/l": { canonical: "mIU/L", factor: 1 },
  "uui/ml": { canonical: "mIU/L", factor: 1 },
  "uiu/ml": { canonical: "mIU/L", factor: 1 },
  "ui/ml": { canonical: "IU/mL", factor: 1 },
  "iu/ml": { canonical: "IU/mL", factor: 1 },

  // Molar and ratio units — passed through, never converted across families
  "mmol/l": { canonical: "mmol/L", factor: 1 },
  "umol/l": { canonical: "µmol/L", factor: 1 },
  "nmol/l": { canonical: "nmol/L", factor: 1 },
  "pmol/l": { canonical: "pmol/L", factor: 1 },
  "mmol/mol": { canonical: "mmol/mol", factor: 1 },
  "meq/l": { canonical: "mEq/L", factor: 1 },

  // Volume, mass and dimensionless
  fl: { canonical: "fL", factor: 1 },
  pg: { canonical: "pg", factor: 1 },
  "%": { canonical: "%", factor: 1 },
  ratio: { canonical: "ratio", factor: 1 },

  // Rates
  "ml/min/1.73m2": { canonical: "mL/min/1.73m²", factor: 1 },
  "ml/min": { canonical: "mL/min", factor: 1 },
  "mm/h": { canonical: "mm/h", factor: 1 },
  "mm/1h": { canonical: "mm/h", factor: 1 },
};

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

/** Collapses the many printed spellings of the same unit into one lookup key. */
export function normalizeUnitKey(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => SUPERSCRIPTS[char] ?? char)
    .replace(/[µμ]/g, "u")
    .replace(/\s+/g, "")
    .replace(/[·*]/g, "")
    .replace(/x10\^?/g, "10^")
    .replace(/10e/g, "10^")
    .replace(/10(\d)/g, "10^$1")
    .replace(/\^\^/g, "^");
}

export function standardizeUnit(originalUnit: string | null): UnitStandardization {
  if (!originalUnit || originalUnit.trim() === "") {
    return {
      standardizedUnit: null,
      factor: 1,
      conversionApplied: false,
      recognized: false,
    };
  }

  const key = normalizeUnitKey(originalUnit);
  const def = UNIT_TABLE[key];

  if (!def) {
    // Unknown units are preserved verbatim rather than guessed at.
    return {
      standardizedUnit: originalUnit.trim(),
      factor: 1,
      conversionApplied: false,
      recognized: false,
    };
  }

  return {
    standardizedUnit: def.canonical,
    factor: def.factor,
    conversionApplied: def.factor !== 1,
    recognized: true,
  };
}

/** Applies the standardization factor, keeping float noise out of the UI. */
export function applyFactor(value: number | null, factor: number): number | null {
  if (value === null) return null;
  if (factor === 1) return value;
  return Number.parseFloat((value * factor).toPrecision(12));
}
