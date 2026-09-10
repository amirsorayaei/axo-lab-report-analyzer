"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/analyzer/status-badge";
import { formatRange } from "@/lib/domain/classify";
import { formatResult } from "@/lib/status-presentation";
import type { AnalyzedBiomarker, StandardizedRange } from "@/lib/domain/schemas";

export function BiomarkerDetailSheet({
  biomarker,
  onOpenChange,
}: {
  biomarker: AnalyzedBiomarker | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={biomarker !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The default close control is a 32px icon button; replaced below with a
        // 44px target that still reads as a compact control.
        showCloseButton={false}
        // The `data-[side=right]` variant in the base component wins on
        // specificity, so the width override has to be scoped the same way.
        className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-md data-[side=right]:lg:max-w-xl"
      >
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2.5 right-2.5 size-11"
          >
            <X aria-hidden />
            <span className="sr-only">Close details</span>
          </Button>
        </SheetClose>
        {biomarker ? <DetailBody biomarker={biomarker} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ biomarker }: { biomarker: AnalyzedBiomarker }) {
  const result = formatResult(biomarker);
  const displayValue = [result.value, result.unit].filter(Boolean).join(" ");

  return (
    <>
      <SheetHeader className="gap-2">
        <SheetTitle className="pr-12 text-left text-lg">
          {biomarker.standardizedName}
        </SheetTitle>
        <SheetDescription className="text-left">
          {biomarker.panel ?? "Laboratory result"}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StatusBadge status={biomarker.status} />
          <span className="text-xs text-muted-foreground">
            Page {biomarker.sourcePage} · Confidence{" "}
            {Math.round(biomarker.confidence * 100)}%
          </span>
        </div>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Result</p>
          <p className="numeric mt-1 text-2xl font-semibold">{displayValue}</p>
          {result.conversionNote ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Converted {result.conversionNote}. The same factor was applied to the
              ranges, so the classification is unchanged.
            </p>
          ) : null}
        </div>

        <Section title="Why this status">
          <p className="text-sm leading-relaxed text-foreground">
            {biomarker.classificationReason}
          </p>
        </Section>

        <Separator />

        <Section title="As printed on the report">
          <Fact label="Biomarker name" value={biomarker.originalName} />
          <Fact label="Value" value={biomarker.originalValue} />
          <Fact label="Unit" value={biomarker.originalUnit ?? "Not stated"} />
          {biomarker.nameSource !== "dictionary" ? (
            <Fact
              label="Name standardization"
              value={
                biomarker.nameSource === "model"
                  ? "Translated by the AI provider; not in the curated dictionary."
                  : "No standardized name available; the original name is shown."
              }
            />
          ) : null}
        </Section>

        <Separator />

        <Section title="Reference ranges">
          <RangeList
            ranges={biomarker.referenceRanges}
            applied={biomarker.appliedReferenceRange}
            emptyLabel="The report does not print a reference range for this biomarker."
          />
        </Section>

        {biomarker.optimalRanges.length > 0 ? (
          <Section title="Optimal ranges printed on the report">
            <RangeList
              ranges={biomarker.optimalRanges}
              applied={biomarker.appliedOptimalRange}
              emptyLabel=""
            />
          </Section>
        ) : null}

        {biomarker.notes ? (
          <>
            <Separator />
            <Section title="Report notes">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {biomarker.notes}
              </p>
            </Section>
          </>
        ) : null}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function RangeList({
  ranges,
  applied,
  emptyLabel,
}: {
  ranges: StandardizedRange[];
  applied: StandardizedRange | null;
  emptyLabel: string;
}) {
  if (ranges.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {ranges.map((range, index) => {
        const isApplied = applied !== null && range.text === applied.text;
        return (
          <li
            key={`${range.text}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
          >
            <span className="numeric font-medium text-foreground">
              {formatRange(range)}
              {isApplied ? (
                <span className="ml-2 text-xs font-normal text-status-optimal">
                  applied
                </span>
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">{range.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
