import type { ErrorCode } from "@/lib/domain/errors";
import type { AnalysisResult } from "@/lib/domain/schemas";

/** Shared with the client, so an error is always a typed code, not a string. */
export type AnalyzeSuccess = {
  ok: true;
  data: AnalysisResult;
};

export type AnalyzeFailure = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    hint?: string;
  };
};

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeFailure;
