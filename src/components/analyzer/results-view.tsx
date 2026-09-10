"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BiomarkerDetailSheet } from "@/components/analyzer/biomarker-detail-sheet";
import { BiomarkerTable } from "@/components/analyzer/biomarker-table";
import { DemoModeBanner } from "@/components/analyzer/demo-mode-banner";
import { MedicalDisclaimer } from "@/components/analyzer/medical-disclaimer";
import { ReportSummary } from "@/components/analyzer/report-summary";
import { SummaryCards } from "@/components/analyzer/summary-cards";
import type { AnalysisResult, AnalyzedBiomarker } from "@/lib/domain/schemas";

export function ResultsView({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const [selected, setSelected] = useState<AnalyzedBiomarker | null>(null);

  return (
    <div className="space-y-6">
      {result.providerMode === "mock" ? (
        <DemoModeBanner providerLabel={result.providerLabel} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Report analysis</h2>
          <p className="text-sm text-muted-foreground">
            {result.summary.total} biomarkers extracted and classified against the
            ranges printed on the report.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onReset} className="sm:shrink-0">
          <RotateCcw aria-hidden />
          Analyze another report
        </Button>
      </div>

      <ReportSummary
        patient={result.patient}
        pageCount={result.pageCount}
        reportLanguage={result.reportLanguage}
      />

      <SummaryCards summary={result.summary} />

      <BiomarkerTable biomarkers={result.biomarkers} onSelect={setSelected} />

      <MedicalDisclaimer />

      <BiomarkerDetailSheet
        biomarker={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
