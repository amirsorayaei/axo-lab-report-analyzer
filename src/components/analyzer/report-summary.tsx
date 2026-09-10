import type { PatientSummary, ReportSourceSummary } from "@/lib/domain/schemas";

const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female" };

const NOT_STATED = "Not stated on the report";

/**
 * Report metadata as a compact definition list. It is context, not findings, so
 * it stays visually quieter than the biomarker summary below it.
 */
export function ReportSummary({
  patient,
  sources,
  reportLanguage,
}: {
  patient: PatientSummary;
  sources: ReportSourceSummary;
  reportLanguage: string | null;
}) {
  const ageNote =
    patient.ageSource === "derived_from_dob" ? " (from date of birth)" : "";

  const facts: Array<{ label: string; value: string }> = [
    {
      label: "Patient",
      value:
        [
          patient.ageYears !== null ? `${patient.ageYears} years${ageNote}` : null,
          patient.sex ? SEX_LABEL[patient.sex] : null,
        ]
          .filter(Boolean)
          .join(" · ") || NOT_STATED,
    },
    {
      label: "Laboratory",
      value: patient.laboratoryName ?? NOT_STATED,
    },
    {
      label: "Report date",
      value: patient.reportDate ?? patient.collectionDate ?? NOT_STATED,
    },
    {
      label: "Sources",
      value:
        [
          `${sources.fileCount} file${sources.fileCount === 1 ? "" : "s"}`,
          sources.pdfCount > 0
            ? `${sources.pdfPageCount} PDF page${sources.pdfPageCount === 1 ? "" : "s"}`
            : null,
          sources.imageCount > 0
            ? `${sources.imageCount} image${sources.imageCount === 1 ? "" : "s"}`
            : null,
          patient.reportId,
          reportLanguage ? reportLanguage.toUpperCase() : null,
        ]
          .filter(Boolean)
          .join(" · ") || NOT_STATED,
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border bg-card px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">
            {fact.label}
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
