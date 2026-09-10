"use client";

import { Check, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Honest progress: these are the real stages of the request, in order. The
 * client cannot observe server-side progress, so the stages advance on estimates
 * and the last one stays busy until the response arrives. Nothing is shown as a
 * percentage, because a percentage would imply a precision we do not have.
 */
export const PROCESSING_STAGES = [
  { id: "validating", label: "Validating files" },
  { id: "reading", label: "Reading report" },
  { id: "extracting", label: "Extracting biomarkers" },
  { id: "classifying", label: "Classifying results" },
  { id: "preparing", label: "Preparing results" },
] as const;

export type ProcessingStageId = (typeof PROCESSING_STAGES)[number]["id"];

export function ProcessingStages({ current }: { current: ProcessingStageId }) {
  const currentIndex = PROCESSING_STAGES.findIndex((stage) => stage.id === current);
  const currentStage = PROCESSING_STAGES[currentIndex];

  return (
    <Card>
      <CardContent className="mx-auto w-full max-w-md space-y-6 py-6">
        <div className="space-y-1.5 text-center">
          <h2 className="text-base font-semibold">Analyzing your report</h2>
          <p className="text-sm text-muted-foreground">
            Processed on the server. Your files are not stored.
          </p>
        </div>

        {/* Step segments rather than a percentage bar: honest about granularity. */}
        <ol className="flex gap-1.5" aria-hidden>
          {PROCESSING_STAGES.map((stage, index) => (
            <li
              key={stage.id}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index < currentIndex && "bg-primary",
                index === currentIndex && "bg-primary/45 motion-safe:animate-pulse",
                index > currentIndex && "bg-muted",
              )}
            />
          ))}
        </ol>

        {/*
         * A single live region announcing the current step. The list itself is
         * not live, so a screen reader hears one concise update per stage.
         */}
        <p className="sr-only" role="status" aria-live="polite">
          Step {currentIndex + 1} of {PROCESSING_STAGES.length}:{" "}
          {currentStage?.label}. In progress.
        </p>

        <ol className="space-y-3">
          {PROCESSING_STAGES.map((stage, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 text-sm",
                  isDone && "text-muted-foreground",
                  isCurrent && "font-medium text-foreground",
                  !isDone && !isCurrent && "text-muted-foreground/55",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <Check className="size-4 text-status-optimal" aria-hidden />
                  ) : isCurrent ? (
                    <Loader2
                      className="size-4 text-primary motion-safe:animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="size-1.5 rounded-full bg-border ring-1 ring-border"
                      aria-hidden
                    />
                  )}
                </span>

                <span className="flex-1">{stage.label}</span>

                {/*
                 * A text cue, not just a spinning icon: with reduced motion the
                 * spinner is static, so the state must still be readable.
                 */}
                {isCurrent ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    In progress
                  </span>
                ) : null}
                {isDone ? <span className="sr-only">Completed</span> : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
