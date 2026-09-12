import "server-only";

import { SAMPLE_REPORT_EXTRACTION } from "@/lib/ai/fixtures/sample-report";
import { RawExtractionSchema } from "@/lib/domain/schemas";
import type { AiProvider } from "@/lib/ai/types";
import type { RawExtraction } from "@/lib/domain/schemas";

/**
 * Ignores the uploaded sources and returns the bundled fixture, always surfaced
 * in the UI as demo mode. Never a fallback for a failed live call.
 */
export class MockAiProvider implements AiProvider {
  readonly label = "Mock provider (bundled sample report)";
  readonly mode = "mock" as const;

  readonly supportsImages = true;

  async extract(): Promise<RawExtraction> {
    // The fixture must satisfy the same contract as a live response.
    return RawExtractionSchema.parse(SAMPLE_REPORT_EXTRACTION);
  }
}
