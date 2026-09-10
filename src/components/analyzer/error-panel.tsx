"use client";

import {
  AlertTriangle,
  Copy,
  CreditCard,
  FileWarning,
  Files,
  Gauge,
  ImageOff,
  KeyRound,
  RotateCcw,
  ScanLine,
  SearchX,
  TimerOff,
  UserX,
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
    NO_FILES: {
      title: "No file was received",
      icon: FileWarning,
      action: "Select at least one report file and try again.",
    },
    TOO_MANY_FILES: {
      title: "Too many files",
      icon: Files,
      action: "Remove some files so that at most 8 are analysed as one report.",
    },
    TOTAL_UPLOAD_TOO_LARGE: {
      title: "The selection is too large",
      icon: Files,
      action: "Remove or replace some files so the combined size stays under 30 MB.",
    },
    DUPLICATE_FILE: {
      title: "The same file was selected twice",
      icon: Copy,
      action: "Remove the duplicate. Each file should be a different part of the report.",
    },
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
    INVALID_IMAGE_SIGNATURE: {
      title: "That file is not a valid image",
      icon: ImageOff,
      action:
        "The contents do not match the extension. Re-export or re-take the photo as JPEG, PNG or WebP.",
    },
    IMAGE_CORRUPTED: {
      title: "The image could not be read",
      icon: ImageOff,
      action: "The file may be damaged. Try re-exporting or re-taking the photo.",
    },
    NO_LAB_DATA_FOUND: {
      title: "No laboratory results found",
      icon: SearchX,
      action:
        "Check that every file is a page of a laboratory report, and that photographs are sharp, upright and well lit.",
    },
    CONFLICTING_PATIENTS: {
      title: "These files look like different patients",
      icon: UserX,
      action:
        "All files in one analysis must be parts of a single report for a single patient. Remove the unrelated files and try again.",
    },
    PROVIDER_NO_IMAGE_SUPPORT: {
      title: "The configured model cannot read images",
      icon: ImageOff,
      action:
        "Upload text-based PDFs instead, or ask an administrator to configure a model with image input support.",
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
  onBackToSelection,
}: {
  code: ErrorCode;
  message: string;
  hint?: string;
  onRetry?: () => void;
  onReset: () => void;
  /** Offered when the fix is to edit the selection rather than start over. */
  onBackToSelection?: () => void;
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
        {onBackToSelection ? (
          <Button type="button" variant="outline" onClick={onBackToSelection}>
            Edit selection
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onReset}>
          Choose other files
        </Button>
      </div>
    </div>
  );
}
