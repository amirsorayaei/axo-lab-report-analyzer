/**
 * Typed error codes shared by the API route and the UI.
 *
 * Every failure path in the pipeline resolves to exactly one of these codes so
 * the client can render a specific, actionable message without parsing strings.
 */
export const ERROR_CODES = [
  "INVALID_FILE_TYPE",
  "EMPTY_FILE",
  "FILE_TOO_LARGE",
  "INVALID_PDF_SIGNATURE",
  "PDF_CORRUPTED",
  "PDF_TEXT_EXTRACTION_FAILED",
  "AI_NOT_CONFIGURED",
  "AI_MISCONFIGURED",
  "AI_TIMEOUT",
  "AI_REQUEST_FAILED",
  "AI_INVALID_RESPONSE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Optional short, user-safe hint. Must never contain PHI or secrets. */
  readonly hint?: string;
  /** HTTP status the route handler should respond with. */
  readonly status: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: { hint?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.hint = options.hint;
    this.status = options.status ?? DEFAULT_STATUS[code];
  }
}

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  INVALID_FILE_TYPE: 415,
  EMPTY_FILE: 400,
  FILE_TOO_LARGE: 413,
  INVALID_PDF_SIGNATURE: 415,
  PDF_CORRUPTED: 422,
  PDF_TEXT_EXTRACTION_FAILED: 422,
  AI_NOT_CONFIGURED: 503,
  AI_MISCONFIGURED: 500,
  AI_TIMEOUT: 504,
  AI_REQUEST_FAILED: 502,
  AI_INVALID_RESPONSE: 502,
  INTERNAL_ERROR: 500,
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("INTERNAL_ERROR", "Unexpected server error.", { cause: error });
}
