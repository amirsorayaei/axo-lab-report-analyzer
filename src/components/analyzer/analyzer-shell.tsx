"use client";

import { useCallback, useRef, useState } from "react";

import { ErrorPanel } from "@/components/analyzer/error-panel";
import {
  ProcessingStages,
  type ProcessingStageId,
} from "@/components/analyzer/processing-stages";
import { ResultsView } from "@/components/analyzer/results-view";
import { SelectedFilesList } from "@/components/analyzer/selected-files-list";
import { UploadDropzone } from "@/components/analyzer/upload-dropzone";
import { MAX_FILES, fileIdentity } from "@/lib/upload/formats";
import type { AnalyzeResponse } from "@/lib/api-types";
import type { AnalysisResult } from "@/lib/domain/schemas";
import type { ErrorCode } from "@/lib/domain/errors";

type ViewState =
  | { name: "idle" }
  | { name: "selected" }
  | { name: "processing"; stage: ProcessingStageId }
  | { name: "error"; code: ErrorCode; message: string; hint?: string }
  | { name: "results"; result: AnalysisResult };

/** Files are held in memory for the request only, never written anywhere. */
export function AnalyzerShell({
  maxUploadMb,
  maxTotalMb,
}: {
  maxUploadMb: number;
  maxTotalMb: number;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [view, setView] = useState<ViewState>({ name: "idle" });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  /** Client-side dedupe and limit checks; the server validates again. */
  const addFiles = useCallback((incoming: File[]) => {
    setFiles((current) => {
      const seen = new Set(current.map(fileIdentity));
      const next = [...current];

      for (const file of incoming) {
        if (next.length >= MAX_FILES) break;
        const identity = fileIdentity(file);
        if (seen.has(identity)) continue;
        seen.add(identity);
        next.push(file);
      }

      return next;
    });
    setView({ name: "selected" });
  }, []);

  const removeAt = useCallback((index: number) => {
    setFiles((current) => {
      const next = current.filter((_, position) => position !== index);
      setView(next.length === 0 ? { name: "idle" } : { name: "selected" });
      return next;
    });
  }, []);

  const analyze = useCallback(
    async (selection: File[]) => {
      clearTimers();
      setView({ name: "processing", stage: "validating" });

      // Server progress is not observable, so these are timed estimates and
      // the last stage stays busy until the response actually arrives.
      const advance = (stage: ProcessingStageId, delay: number) => {
        timers.current.push(
          setTimeout(() => {
            setView((current) =>
              current.name === "processing" ? { ...current, stage } : current,
            );
          }, delay),
        );
      };
      advance("reading", 600);
      advance("extracting", 1800);
      advance("classifying", 8000);
      advance("preparing", 14000);

      const body = new FormData();
      for (const file of selection) body.append("files", file);

      try {
        const response = await fetch("/api/analyze", { method: "POST", body });
        const payload = (await response.json()) as AnalyzeResponse;

        clearTimers();

        if (!payload.ok) {
          setView({
            name: "error",
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
    setFiles([]);
    setView({ name: "idle" });
  }, [clearTimers]);

  if (view.name === "results") {
    return <ResultsView result={view.result} onReset={reset} />;
  }

  if (view.name === "processing") {
    return (
      <div className="mx-auto max-w-2xl">
        <ProcessingStages current={view.stage} />
      </div>
    );
  }

  if (view.name === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorPanel
          code={view.code}
          message={view.message}
          hint={view.hint}
          onRetry={files.length > 0 ? () => analyze(files) : undefined}
          onReset={reset}
          onBackToSelection={
            files.length > 0 ? () => setView({ name: "selected" }) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Your lab report, made clear
        </h1>
        <p className="text-sm text-pretty text-muted-foreground sm:text-base">
          Upload a PDF or images. We&rsquo;ll organize every biomarker, standardize
          its name and unit, and compare it with the ranges printed by your lab.
        </p>
      </div>

      {files.length > 0 ? (
        <SelectedFilesList
          files={files}
          onAdd={addFiles}
          onRemove={removeAt}
          onRemoveAll={reset}
          onAnalyze={() => analyze(files)}
        />
      ) : (
        <UploadDropzone
          maxUploadMb={maxUploadMb}
          maxTotalMb={maxTotalMb}
          onSelect={addFiles}
        />
      )}
    </div>
  );
}
