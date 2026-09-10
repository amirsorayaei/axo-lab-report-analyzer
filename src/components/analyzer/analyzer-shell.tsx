"use client";

import { useCallback, useRef, useState } from "react";

import { ErrorPanel } from "@/components/analyzer/error-panel";
import {
  ProcessingStages,
  type ProcessingStageId,
} from "@/components/analyzer/processing-stages";
import { ResultsView } from "@/components/analyzer/results-view";
import { SelectedFileCard } from "@/components/analyzer/selected-file-card";
import { UploadDropzone } from "@/components/analyzer/upload-dropzone";
import { MedicalDisclaimer } from "@/components/analyzer/medical-disclaimer";
import type { AnalyzeResponse } from "@/lib/api-types";
import type { AnalysisResult } from "@/lib/domain/schemas";
import type { ErrorCode } from "@/lib/domain/errors";

type ViewState =
  | { name: "idle" }
  | { name: "selected"; file: File }
  | { name: "processing"; file: File; stage: ProcessingStageId }
  | { name: "error"; file: File | null; code: ErrorCode; message: string; hint?: string }
  | { name: "results"; result: AnalysisResult };

/**
 * Client state machine for the whole flow. It holds the File in memory only for
 * the duration of the request and never writes it anywhere.
 */
export function AnalyzerShell({ maxUploadMb }: { maxUploadMb: number }) {
  const [view, setView] = useState<ViewState>({ name: "idle" });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const analyze = useCallback(
    async (file: File) => {
      clearTimers();
      setView({ name: "processing", file, stage: "validating" });

      // The stage list mirrors what the server actually does, in order. The
      // client cannot observe server-side progress, so the transitions are
      // time-based estimates and the last stage stays busy until the real
      // response arrives — nothing is ever reported as finished.
      const advance = (stage: ProcessingStageId, delay: number) => {
        timers.current.push(
          setTimeout(() => {
            setView((current) =>
              current.name === "processing" ? { ...current, stage } : current,
            );
          }, delay),
        );
      };
      advance("extracting", 500);
      advance("analyzing", 1600);
      advance("normalizing", 6000);

      const body = new FormData();
      body.append("file", file);

      try {
        const response = await fetch("/api/analyze", { method: "POST", body });
        const payload = (await response.json()) as AnalyzeResponse;

        clearTimers();

        if (!payload.ok) {
          setView({
            name: "error",
            file,
            code: payload.error.code,
            message: payload.error.message,
            hint: payload.error.hint,
          });
          return;
        }

        setView({ name: "results", result: payload.data });
      } catch {
        clearTimers();
        setView({
          name: "error",
          file,
          code: "AI_REQUEST_FAILED",
          message: "The analysis request could not be completed.",
          hint: "Check your network connection and try again.",
        });
      }
    },
    [clearTimers],
  );

  const reset = useCallback(() => {
    clearTimers();
    setView({ name: "idle" });
  }, [clearTimers]);

  if (view.name === "results") {
    return <ResultsView result={view.result} onReset={reset} />;
  }

  if (view.name === "processing") {
    return <ProcessingStages current={view.stage} />;
  }

  if (view.name === "error") {
    const retryFile = view.file;
    return (
      <ErrorPanel
        code={view.code}
        message={view.message}
        hint={view.hint}
        onRetry={retryFile ? () => analyze(retryFile) : undefined}
        onReset={reset}
      />
    );
  }

  return (
    <div className="space-y-4">
      {view.name === "selected" ? (
        <SelectedFileCard
          file={view.file}
          onRemove={reset}
          onAnalyze={() => analyze(view.file)}
        />
      ) : (
        <UploadDropzone
          maxUploadMb={maxUploadMb}
          onSelect={(file) => setView({ name: "selected", file })}
        />
      )}

      <MedicalDisclaimer />
    </div>
  );
}
