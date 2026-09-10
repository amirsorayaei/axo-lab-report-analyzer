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
import { MedicalDisclaimer } from "@/components/analyzer/medical-disclaimer";
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

/**
 * Client state machine for the whole flow. The ordered file collection is held
 * in memory only for the duration of the request and never written anywhere.
 */
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

  /**
   * Appends rather than replaces, skips exact duplicates, and stops at the file
   * limit. The server re-checks all three — this is only for fast feedback.
   */
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
    return <ProcessingStages current={view.stage} />;
  }

  if (view.name === "error") {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
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

      <MedicalDisclaimer />
    </div>
  );
}
