"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/analyzer/status-badge";
import { formatRange } from "@/lib/domain/classify";
import { STATUS_ORDER, STATUS_PRESENTATION, formatResult } from "@/lib/status-presentation";
import type { AnalyzedBiomarker, BiomarkerStatus } from "@/lib/domain/schemas";

type StatusFilter = BiomarkerStatus | "all";

export function BiomarkerTable({
  biomarkers,
  onSelect,
}: {
  biomarkers: AnalyzedBiomarker[];
  onSelect: (biomarker: AnalyzedBiomarker) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return biomarkers.filter((biomarker) => {
      if (status !== "all" && biomarker.status !== status) return false;
      if (needle === "") return true;

      return [
        biomarker.standardizedName,
        biomarker.originalName,
        biomarker.panel ?? "",
        biomarker.standardizedUnit ?? "",
        biomarker.originalUnit ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [biomarkers, query, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search biomarkers, panels or units"
            aria-label="Search biomarkers"
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((item) => (
              <SelectItem key={item} value={item}>
                {STATUS_PRESENTATION[item].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {biomarkers.length} biomarkers.
      </p>

      <Card className="py-0">
        <div className="divide-y lg:hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No biomarkers match your filters.
            </p>
          ) : (
            filtered.map((biomarker) => {
              const result = formatResult(biomarker);
              const shownRange =
                biomarker.appliedReferenceRange ?? biomarker.referenceRanges[0] ?? null;

              return (
                <button
                  key={biomarker.id}
                  type="button"
                  onClick={() => onSelect(biomarker)}
                  className="group flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {biomarker.standardizedName}
                        </p>
                        {biomarker.originalName !== biomarker.standardizedName ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {biomarker.originalName}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={biomarker.status} className="shrink-0" />
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {result.value}
                        {result.unit ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {result.unit}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground">
                        Range: {shownRange ? formatRange(shownRange) : "Not stated"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="hidden lg:block">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Biomarker</TableHead>
              <TableHead className="min-w-32">Result</TableHead>
              <TableHead className="min-w-40">Reference range</TableHead>
              <TableHead className="min-w-32">Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No biomarker matches this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((biomarker) => {
                const result = formatResult(biomarker);
                // Fall back to the first printed range so the column still shows
                // what the report says, even when nothing could be applied.
                const shownRange =
                  biomarker.appliedReferenceRange ?? biomarker.referenceRanges[0] ?? null;

                return (
                  <TableRow key={biomarker.id} className="align-top">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onSelect(biomarker)}
                      className="min-h-9 text-left font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {biomarker.standardizedName}
                    </button>
                    {biomarker.originalName !== biomarker.standardizedName ? (
                      <p className="text-xs text-muted-foreground">
                        {biomarker.originalName}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell className="tabular-nums">
                    <span className="font-medium">{result.value}</span>
                    {result.unit ? (
                      <span className="ml-1 text-muted-foreground">{result.unit}</span>
                    ) : null}
                    {result.conversionNote ? (
                      <p className="text-xs text-muted-foreground">
                        {result.conversionNote}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell className="tabular-nums text-muted-foreground">
                    {shownRange ? formatRange(shownRange) : "—"}
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={biomarker.status} />
                  </TableCell>

                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onSelect(biomarker)}
                      aria-label={`Open details for ${biomarker.standardizedName}`}
                      className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
