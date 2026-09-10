import "server-only";

import { AppError } from "@/lib/domain/errors";
import type { AiProvider } from "@/lib/ai/types";

/**
 * Safe default. The app installs, builds and runs without an API key; analysis
 * fails loudly with a controlled error instead of silently falling back to
 * fixture data, which would be dangerous in a health context.
 */
export class DisabledAiProvider implements AiProvider {
  readonly label = "Disabled";
  readonly mode = "live" as const;
  readonly supportsImages = false;

  async extract(): Promise<never> {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "No AI provider is configured on this server.",
      {
        hint: "Set AI_PROVIDER=mock in .env.local to explore the app with the bundled sample report, or configure an OpenAI-compatible provider.",
      },
    );
  }
}
