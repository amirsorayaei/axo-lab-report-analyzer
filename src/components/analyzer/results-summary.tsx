"use client";

import { Card, CardContent } from "@/components/ui/card";
import { STATUS_ORDER, STATUS_PRESENTATION } from "@/lib/status-presentation";
import { cn } from "@/lib/utils";
import type { AnalysisSummary, BiomarkerStatus } from "@/lib/domain/schemas";
import type { StatusFilter } from "@/components/analyzer/biomarker-results";

const COUNT_BY_STATUS: Record<BiomarkerStatus, keyof AnalysisSummary> = {
  optimal: "optimal",
  normal: "normal",
  out_of_range: "outOfRange",
  needs_review: "needsReview",
};

/** The four status counts double as filters for the list below. */
export function ResultsSummary({
  summary,
  activeStatus,
  onStatusChange,
}: {
  summary: AnalysisSummary;
  activeStatus: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0 sm:border-r sm:pr-6">
          <span className="numeric text-3xl leading-none font-semibold text-foreground">
            {summary.total}
          </span>
          <span className="text-xs text-muted-foreground">biomarkers extracted</span>
        </div>

        <div
          className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4"
          role="group"
          aria-label="Filter biomarkers by status"
        >
          {STATUS_ORDER.map((status) => {
            const presentation = STATUS_PRESENTATION[status];
            const Icon = presentation.icon;
            const count = summary[COUNT_BY_STATUS[status]];
            const isActive = activeStatus === status;

            return (
              <button
                key={status}
                type="button"
                aria-pressed={isActive}
                onClick={() => onStatusChange(isActive ? "all" : status)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  isActive
                    ? "border-primary/40 bg-accent/60"
                    : "border-transparent bg-muted/40",
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", presentation.textClass)}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="numeric block text-base leading-tight font-semibold text-foreground">
                    {count}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {presentation.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
