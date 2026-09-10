"use client";

import {
  AlertTriangle,
  CreditCard,
  FileWarning,
  Gauge,
  KeyRound,
  RotateCcw,
  ScanLine,
  TimerOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ErrorCode } from "@/lib/domain/errors";

/**
 * Every typed error code gets a human title, an icon and a next step. Codes are
 * shown too, so a user can quote one in a support request without pasting any
 * report content.
 */
const PRESENTATION: Record<ErrorCode, { title: string; icon: LucideIcon; action: string }> =
  {
    INVALID_FILE_TYPE: {
      title: "That file is not a PDF",
      icon: FileWarning,
      action: "Choose a PDF exported from your laboratory portal.",
    },
    EMPTY_FILE: {
      title: "The file is empty",
      icon: FileWarning,
      action: "Choose a different file.",
    },
    FILE_TOO_LARGE: {
      title: "The file is too large",
      icon: FileWarning,
      action: "Upload a smaller PDF, or split the report before uploading.",
    },
    INVALID_PDF_SIGNATURE: {
      title: "This file is not a valid PDF",
      icon: FileWarning,
      action: "The contents do not look like a PDF. Try re-exporting the report.",
    },
    PDF_CORRUPTED: {
      title: "The PDF could not be opened",
      icon: FileWarning,
      action: "Re-download the report from your laboratory and try again.",
    },
    PDF_TEXT_EXTRACTION_FAILED: {
      title: "No readable text in this PDF",
      icon: ScanLine,
      action:
        "This looks like a scan or a photo. Optical character recognition is not enabled in this version, so please upload a text-based PDF.",
    },
    AI_NOT_CONFIGURED: {
      title: "No AI provider is configured",
      icon: KeyRound,
      action:
        "Analysis is disabled on this server. Set AI_PROVIDER=mock to explore the demo, or configure a provider.",
    },
    AI_MISCONFIGURED: {
      title: "The AI provider is misconfigured",
      icon: KeyRound,
      action: "Check the server environment variables and try again.",
    },
    AI_TIMEOUT: {
      title: "The AI provider timed out",
      icon: TimerOff,
      action: "The provider took too long to answer. Try again in a moment.",
    },
    AI_RATE_LIMITED: {
      title: "Too many requests right now",
      icon: Gauge,
      action:
        "The AI provider is rate limiting this account. Wait a moment and try again.",
    },
    AI_INSUFFICIENT_CREDITS: {
      title: "The AI provider account is out of credits",
      icon: CreditCard,
      action:
        "Analysis could not run because the provider account has no remaining balance. Top it up and try again.",
    },
    AI_STRUCTURED_OUTPUT_UNSUPPORTED: {
      title: "The configured model cannot return structured output",
      icon: KeyRound,
      action:
        "No provider is available for this model with the options this app requires. Check the configured model on the server.",
    },
    AI_REQUEST_FAILED: {
      title: "The AI provider could not be reached",
      icon: AlertTriangle,
      action: "This is usually temporary. Try again in a moment.",
    },
    AI_INVALID_RESPONSE: {
      title: "The AI provider returned an unusable response",
      icon: AlertTriangle,
      action:
        "The response did not match the expected structure, so it was rejected instead of being shown. Try again.",
    },
    INTERNAL_ERROR: {
      title: "Something went wrong",
      icon: AlertTriangle,
      action: "An unexpected error occurred while processing the report.",
    },
  };

export function ErrorPanel({
  code,
  message,
  hint,
  onRetry,
  onReset,
}: {
  code: ErrorCode;
  message: string;
  hint?: string;
  onRetry?: () => void;
  onReset: () => void;
}) {
  const presentation = PRESENTATION[code] ?? PRESENTATION.INTERNAL_ERROR;
  const Icon = presentation.icon;

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <Icon aria-hidden />
        <AlertTitle>{presentation.title}</AlertTitle>
        <AlertDescription>
          <p>{message}</p>
          {hint ? <p>{hint}</p> : null}
          <p>{presentation.action}</p>
          <p className="text-xs opacity-80">Error code: {code}</p>
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            <RotateCcw aria-hidden />
            Try again
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onReset}>
          Choose another file
        </Button>
      </div>
    </div>
  );
}
