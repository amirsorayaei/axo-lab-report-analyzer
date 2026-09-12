import "server-only";

import type { RawExtraction } from "@/lib/domain/schemas";
import type { ReportInput } from "@/lib/upload/report-input";

export type ExtractionRequest = {
  /** Ordered exactly as the user arranged them. */
  inputs: ReportInput[];
  signal: AbortSignal;
};

/**
 * A provider never classifies, converts units or supplies a threshold, so the
 * deterministic pipeline downstream is provider-agnostic.
 */
export interface AiProvider {
  /** User-visible; never a secret. */
  readonly label: string;
  /** `mock` makes the UI show a demo-mode banner. */
  readonly mode: "mock" | "live";
  /** Declared, not probed, so an image upload is refused before a request. */
  readonly supportsImages: boolean;
  extract(request: ExtractionRequest): Promise<RawExtraction>;
}
