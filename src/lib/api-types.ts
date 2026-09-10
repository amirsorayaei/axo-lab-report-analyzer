import type { ErrorCode } from "@/lib/domain/errors";
import type { AnalysisResult } from "@/lib/domain/schemas";

/**
 * The single response shape of `POST /api/analyze`. Shared by the route handler
 * and the client, so an error is always a typed code rather than a string the UI
 * has to interpret.
 */
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
