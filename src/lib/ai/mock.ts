import "server-only";

import { SAMPLE_REPORT_EXTRACTION } from "@/lib/ai/fixtures/sample-report";
import { RawExtractionSchema } from "@/lib/domain/schemas";
import type { AiProvider } from "@/lib/ai/types";
import type { RawExtraction } from "@/lib/domain/schemas";

/**
 * Demo provider. Enabled only when AI_PROVIDER=mock, and always surfaced in the
 * UI as demo mode: it ignores the uploaded sources — one file or eight, PDF or
 * image — and returns the bundled sample extraction. It exists so the interface,
 * the pipeline and the UI can be reviewed without a provider decision, never as
 * a fallback for a failed call.
 */
export class MockAiProvider implements AiProvider {
  readonly label = "Mock provider (bundled sample report)";
  readonly mode = "mock" as const;
  /** The fixture is returned whatever the sources are, images included. */
  readonly supportsImages = true;

  async extract(): Promise<RawExtraction> {
    // Validated like any provider response: the fixture must satisfy the same
    // contract a live model has to satisfy.
    return RawExtractionSchema.parse(SAMPLE_REPORT_EXTRACTION);
  }
}
