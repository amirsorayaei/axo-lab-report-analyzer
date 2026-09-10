"use client";

import { ChevronRight, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Search } from "lucide-react";

export type StatusFilter = BiomarkerStatus | "all";

/**
 * Filtering lives next to the UI that drives it, but the state is owned by the
 * results view so the summary counts can act as filters too.
 */
export function filterBiomarkers(
  biomarkers: AnalyzedBiomarker[],
  { query, status }: { query: string; status: StatusFilter },
): AnalyzedBiomarker[] {
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
}

/** Fall back to the first printed range so the row still shows what the lab said. */
function displayRange(biomarker: AnalyzedBiomarker) {
  return biomarker.appliedReferenceRange ?? biomarker.referenceRanges[0] ?? null;
}

export function BiomarkerResults({
  biomarkers,
  totalCount,
  query,
  onQueryChange,
  status,
  onStatusChange,
  onSelect,
}: {
  /** Already filtered by the parent. */
  biomarkers: AnalyzedBiomarker[];
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  onSelect: (biomarker: AnalyzedBiomarker) => void;
}) {
  const isFiltered = query.trim() !== "" || status !== "all";

  const clearFilters = () => {
    onQueryChange("");
    onStatusChange("all");
  };

  return (
    <section aria-labelledby="biomarkers-heading" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <h2 id="biomarkers-heading" className="sr-only">
          Biomarker results
        </h2>

        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search biomarkers, panels or units"
            aria-label="Search biomarkers"
            className="h-11 pl-9"
          />
        </div>

        <Select value={status} onValueChange={(value) => onStatusChange(value as StatusFilter)}>
          {/*
           * `data-[size=default]:h-8` in the primitive wins on specificity, so
           * the touch-size override has to be scoped the same way.
           */}
          <SelectTrigger
            className="w-full data-[size=default]:h-11 sm:w-52"
            aria-label="Filter by status"
          >
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

      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        Showing {biomarkers.length} of {totalCount} biomarkers
        {isFiltered ? " (filtered)" : ""}.
      </p>

      {biomarkers.length === 0 ? (
        <EmptyState onClear={clearFilters} />
      ) : (
        <Card className="py-0">
          {/*
           * Below `lg` the table cannot show Result, Reference range and Status
           * without clipping them off-screen, so the same data is rendered as
           * full-width rows instead. Nothing is hidden at any width.
           */}
          <ul className="divide-y lg:hidden">
            {biomarkers.map((biomarker) => (
              <BiomarkerRow
                key={biomarker.id}
                biomarker={biomarker}
                onSelect={onSelect}
              />
            ))}
          </ul>

          {/* A safety net only: at `lg` and up the columns already fit. */}
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Biomarker</TableHead>
                  <TableHead className="min-w-32">Result</TableHead>
                  <TableHead className="min-w-40">Reference range</TableHead>
                  <TableHead className="min-w-36">Status</TableHead>
                  <TableHead className="w-14">
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {biomarkers.map((biomarker) => {
                  const result = formatResult(biomarker);
                  const range = displayRange(biomarker);

                  return (
                    <TableRow
                      key={biomarker.id}
                      onClick={() => onSelect(biomarker)}
                      className="cursor-pointer align-top hover:bg-muted/50"
                    >
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {biomarker.standardizedName}
                        </span>
                        {biomarker.originalName !== biomarker.standardizedName ? (
                          <p className="text-xs text-muted-foreground">
                            {biomarker.originalName}
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell className="numeric">
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

                      <TableCell className="numeric text-muted-foreground">
                        {range ? formatRange(range) : "—"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={biomarker.status} />
                      </TableCell>

                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          aria-label={`Open details for ${biomarker.standardizedName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(biomarker);
                          }}
                        >
                          <ChevronRight aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </section>
  );
}

/**
 * One biomarker as a full-width, touch-sized row. The whole row is a single
 * button, so mouse, touch and keyboard all reach the detail sheet the same way.
 */
function BiomarkerRow({
  biomarker,
  onSelect,
}: {
  biomarker: AnalyzedBiomarker;
  onSelect: (biomarker: AnalyzedBiomarker) => void;
}) {
  const result = formatResult(biomarker);
  const range = displayRange(biomarker);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(biomarker)}
        aria-label={`${biomarker.standardizedName}, ${result.value} ${result.unit ?? ""}, ${STATUS_PRESENTATION[biomarker.status].label}. Open details.`}
        className="flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">
                {biomarker.standardizedName}
              </span>
              {biomarker.originalName !== biomarker.standardizedName ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {biomarker.originalName}
                </span>
              ) : null}
            </span>
            <StatusBadge status={biomarker.status} className="shrink-0" />
          </span>

          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="numeric text-base font-semibold text-foreground">
              {result.value}
              {result.unit ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {result.unit}
                </span>
              ) : null}
            </span>
            <span className="numeric text-xs text-muted-foreground">
              Ref {range ? formatRange(range) : "not stated"}
            </span>
          </span>
        </span>

        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="font-medium text-foreground">No biomarkers match your filters</p>
          <p className="text-sm text-muted-foreground">
            Try a different search term, or show all statuses.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClear} className="h-10">
          Clear filters
        </Button>
      </div>
    </Card>
  );
}
