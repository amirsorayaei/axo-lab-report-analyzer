"use client";

import { Check, Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Honest progress: these are the four real stages of the request, and the client
 * only advances them as far as it can actually know. The final stage stays busy
 * until the server responds rather than pretending to reach 100%.
 */
export const PROCESSING_STAGES = [
  { id: "validating", label: "Validating the file" },
  { id: "extracting", label: "Extracting text from the PDF" },
  { id: "analyzing", label: "Reading biomarkers with the AI provider" },
  { id: "normalizing", label: "Standardizing units and classifying results" },
] as const;

export type ProcessingStageId = (typeof PROCESSING_STAGES)[number]["id"];

export function ProcessingStages({ current }: { current: ProcessingStageId }) {
  const currentIndex = PROCESSING_STAGES.findIndex((stage) => stage.id === current);
  const percent = ((currentIndex + 1) / (PROCESSING_STAGES.length + 1)) * 100;

  return (
    <div
      className="rounded-xl border bg-card p-6 sm:p-8"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-base font-semibold">Analyzing your report</h2>
          <p className="text-sm text-muted-foreground">
            The file is processed on the server and is not stored.
          </p>
        </div>

        <Progress value={percent} aria-label="Analysis progress" />

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
                  !isDone && !isCurrent && "text-muted-foreground/60",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <Check className="size-4 text-status-optimal" aria-hidden />
                  ) : isCurrent ? (
                    <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                  ) : (
                    <span className="size-1.5 rounded-full bg-border" aria-hidden />
                  )}
                </span>
                {stage.label}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
