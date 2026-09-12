/**
 * Every failure path resolves to exactly one code, so the client renders a
 * specific message without parsing strings.
 */
export const ERROR_CODES = [
  "NO_FILES",
  "TOO_MANY_FILES",
  "TOTAL_UPLOAD_TOO_LARGE",
  "DUPLICATE_FILE",
  "INVALID_FILE_TYPE",
  "EMPTY_FILE",
  "FILE_TOO_LARGE",
  "INVALID_PDF_SIGNATURE",
  "PDF_CORRUPTED",
  "PDF_TEXT_EXTRACTION_FAILED",
  "INVALID_IMAGE_SIGNATURE",
  "IMAGE_CORRUPTED",
  "NO_LAB_DATA_FOUND",
  "CONFLICTING_PATIENTS",
  "PROVIDER_NO_IMAGE_SUPPORT",
  "AI_NOT_CONFIGURED",
  "AI_MISCONFIGURED",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_INSUFFICIENT_CREDITS",
  "AI_STRUCTURED_OUTPUT_UNSUPPORTED",
  "AI_REQUEST_FAILED",
  "AI_INVALID_RESPONSE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Must never contain PHI or secrets. */
  readonly hint?: string;
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
  NO_FILES: 400,
  TOO_MANY_FILES: 413,
  TOTAL_UPLOAD_TOO_LARGE: 413,
  DUPLICATE_FILE: 400,
  INVALID_FILE_TYPE: 415,
  EMPTY_FILE: 400,
  FILE_TOO_LARGE: 413,
  INVALID_PDF_SIGNATURE: 415,
  PDF_CORRUPTED: 422,
  PDF_TEXT_EXTRACTION_FAILED: 422,
  INVALID_IMAGE_SIGNATURE: 415,
  IMAGE_CORRUPTED: 422,
  NO_LAB_DATA_FOUND: 422,
  CONFLICTING_PATIENTS: 422,
  PROVIDER_NO_IMAGE_SUPPORT: 503,
  AI_NOT_CONFIGURED: 503,
  AI_MISCONFIGURED: 500,
  AI_TIMEOUT: 504,
  AI_RATE_LIMITED: 429,
  AI_INSUFFICIENT_CREDITS: 402,
  AI_STRUCTURED_OUTPUT_UNSUPPORTED: 502,
  AI_REQUEST_FAILED: 502,
  AI_INVALID_RESPONSE: 502,
  INTERNAL_ERROR: 500,
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("INTERNAL_ERROR", "Unexpected server error.", { cause: error });
}
