import "server-only";

import { z } from "zod";

import { AppError } from "@/lib/domain/errors";

/**
 * Server-only configuration. Nothing here is prefixed with `NEXT_PUBLIC_`, so no
 * value in this module can reach the browser bundle. Secrets are read but never
 * logged, never returned in an API response and never included in an error.
 */

const AI_PROVIDERS = ["disabled", "mock", "openai-compatible"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

const EnvSchema = z.object({
  AI_PROVIDER: z.enum(AI_PROVIDERS).default("disabled"),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).default(60_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(50).default(10),
});

export type ServerConfig = {
  aiProvider: AiProviderName;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  aiTimeoutMs: number;
  aiMaxRetries: number;
  maxUploadBytes: number;
};

let cached: ServerConfig | null = null;

export function getServerConfig(): ServerConfig {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse({
    AI_PROVIDER: emptyToUndefined(process.env.AI_PROVIDER),
    AI_API_KEY: emptyToUndefined(process.env.AI_API_KEY),
    AI_BASE_URL: emptyToUndefined(process.env.AI_BASE_URL),
    AI_MODEL: emptyToUndefined(process.env.AI_MODEL),
    AI_TIMEOUT_MS: emptyToUndefined(process.env.AI_TIMEOUT_MS),
    AI_MAX_RETRIES: emptyToUndefined(process.env.AI_MAX_RETRIES),
    MAX_UPLOAD_SIZE_MB: emptyToUndefined(process.env.MAX_UPLOAD_SIZE_MB),
  });

  if (!parsed.success) {
    // Only the offending variable names are surfaced, never their values.
    const fields = Object.keys(z.flattenError(parsed.error).fieldErrors).join(", ");
    throw new AppError(
      "AI_MISCONFIGURED",
      "The server environment configuration is invalid.",
      { hint: `Check these environment variables: ${fields}` },
    );
  }

  const env = parsed.data;
  cached = {
    aiProvider: env.AI_PROVIDER,
    aiApiKey: env.AI_API_KEY,
    aiBaseUrl: env.AI_BASE_URL,
    aiModel: env.AI_MODEL,
    aiTimeoutMs: env.AI_TIMEOUT_MS,
    aiMaxRetries: env.AI_MAX_RETRIES,
    maxUploadBytes: Math.round(env.MAX_UPLOAD_SIZE_MB * 1024 * 1024),
  };

  return cached;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}
