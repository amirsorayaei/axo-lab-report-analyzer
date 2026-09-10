import { Building2, CalendarDays, Files, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { PatientSummary, ReportSourceSummary } from "@/lib/domain/schemas";

const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female" };

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
    patient.ageSource === "derived_from_dob"
      ? " (derived from date of birth)"
      : "";

  const facts: Array<{ icon: LucideIcon; label: string; value: string }> = [
    {
      icon: User,
      label: "Patient",
      value: [
        patient.ageYears !== null ? `${patient.ageYears} years${ageNote}` : null,
        patient.sex ? SEX_LABEL[patient.sex] : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not stated on the report",
    },
    {
      icon: Building2,
      label: "Laboratory",
      value: patient.laboratoryName ?? "Not stated on the report",
    },
    {
      icon: CalendarDays,
      label: "Report date",
      value: patient.reportDate ?? patient.collectionDate ?? "Not stated on the report",
    },
    {
      icon: Files,
      label: "Sources",
      value: [
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
        .join(" · "),
    },
  ];

  return (
    <Card>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <fact.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm text-foreground">{fact.value}</dd>
            </div>
          </div>
        ))}
        </dl>
      </CardContent>
    </Card>
  );
}
