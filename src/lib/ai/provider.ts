import "server-only";

import { DisabledAiProvider } from "@/lib/ai/disabled";
import { MockAiProvider } from "@/lib/ai/mock";
import { OpenAiCompatibleProvider } from "@/lib/ai/openai-compatible";
import { getServerConfig } from "@/lib/config";
import { AppError } from "@/lib/domain/errors";
import type { AiProvider } from "@/lib/ai/types";

/**
 * Resolves the provider from the environment. There is deliberately no fallback
 * path: a misconfigured live provider fails with AI_MISCONFIGURED rather than
 * quietly serving fixture data.
 */
export function getAiProvider(): AiProvider {
  const config = getServerConfig();

  switch (config.aiProvider) {
    case "mock":
      return new MockAiProvider();

    case "openai-compatible": {
      const missing = [
        !config.aiApiKey && "AI_API_KEY",
        !config.aiBaseUrl && "AI_BASE_URL",
        !config.aiModel && "AI_MODEL",
      ].filter((entry): entry is string => typeof entry === "string");

      if (missing.length > 0 || !config.aiApiKey || !config.aiBaseUrl || !config.aiModel) {
        throw new AppError(
          "AI_MISCONFIGURED",
          "The configured AI provider is missing required settings.",
          { hint: `Missing environment variables: ${missing.join(", ")}` },
        );
      }

      return new OpenAiCompatibleProvider({
        apiKey: config.aiApiKey,
        baseUrl: config.aiBaseUrl,
        model: config.aiModel,
        temperature: config.aiTemperature,
        timeoutMs: config.aiTimeoutMs,
        maxRetries: config.aiMaxRetries,
        appUrl: config.aiAppUrl,
        appTitle: config.aiAppTitle,
        supportsImages: config.aiSupportsImages,
      });
    }

    case "disabled":
    default:
      return new DisabledAiProvider();
  }
}
