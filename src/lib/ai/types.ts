import "server-only";

import type { RawExtraction } from "@/lib/domain/schemas";
import type { ReportInput } from "@/lib/upload/report-input";

export type ExtractionRequest = {
  /** Ordered sources, exactly as the user arranged them. */
  inputs: ReportInput[];
  /** Aborts the provider call when the caller times out or the client leaves. */
  signal: AbortSignal;
};

/**
 * Every provider returns the same validated shape, so the deterministic pipeline
 * downstream is completely provider-agnostic. A provider never classifies, never
 * converts units and never supplies a threshold.
 */
export interface AiProvider {
  /** Short, user-visible label, e.g. "Mock (sample report)". Never a secret. */
  readonly label: string;
  /** `mock` makes the UI show a demo-mode banner. */
  readonly mode: "mock" | "live";
  /**
   * Whether this provider can accept image sources. Declared rather than probed:
   * it lets the app refuse an image upload before spending a request.
   */
  readonly supportsImages: boolean;
  extract(request: ExtractionRequest): Promise<RawExtraction>;
}
