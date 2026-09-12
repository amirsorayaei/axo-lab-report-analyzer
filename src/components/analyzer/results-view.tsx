"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BiomarkerDetailSheet } from "@/components/analyzer/biomarker-detail-sheet";
import {
  BiomarkerResults,
  filterBiomarkers,
  type StatusFilter,
} from "@/components/analyzer/biomarker-results";
import { DemoModeNotice } from "@/components/analyzer/demo-mode-banner";
import { MedicalDisclaimer } from "@/components/analyzer/medical-disclaimer";
import { ReportSummary } from "@/components/analyzer/report-summary";
import { ResultsSummary } from "@/components/analyzer/results-summary";
import type { AnalysisResult, AnalyzedBiomarker } from "@/lib/domain/schemas";

export function ResultsView({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const [selected, setSelected] = useState<AnalyzedBiomarker | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Filter state lives here so the summary counts can drive the list below.
  const filtered = useMemo(
    () => filterBiomarkers(result.biomarkers, { query, status }),
    [result.biomarkers, query, status],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Report analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Classified against the ranges printed on your report.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-10 self-start sm:shrink-0"
        >
          <RotateCcw aria-hidden />
          Analyze another report
        </Button>
      </div>

      {result.providerMode === "mock" ? (
        <DemoModeNotice providerLabel={result.providerLabel} />
      ) : null}

      <ReportSummary
        patient={result.patient}
        sources={result.sources}
        reportLanguage={result.reportLanguage}
      />

      <ResultsSummary
        summary={result.summary}
        activeStatus={status}
        onStatusChange={setStatus}
      />

      <BiomarkerResults
        biomarkers={filtered}
        totalCount={result.biomarkers.length}
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        onSelect={setSelected}
      />

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
