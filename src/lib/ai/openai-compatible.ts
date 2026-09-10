import "server-only";

import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "@/lib/ai/prompt";
import { AppError } from "@/lib/domain/errors";
import type { ErrorCode } from "@/lib/domain/errors";
import { RawExtractionSchema } from "@/lib/domain/schemas";
import type { AiProvider, ExtractionRequest } from "@/lib/ai/types";
import type { RawExtraction } from "@/lib/domain/schemas";

export type OpenAiCompatibleOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** `null` sends no temperature field at all. */
  temperature: number | null;
  timeoutMs: number;
  maxRetries: number;
  /** Optional OpenRouter attribution. Never required for a request to succeed. */
  appUrl: string;
  appTitle: string;
};

/**
 * OpenRouter accepts the OpenAI wire format plus a few extensions. They are
 * applied only when the base URL points at OpenRouter, so every other
 * OpenAI-compatible endpoint keeps receiving a plain, portable request body.
 */
function isOpenRouter(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith("openrouter.ai");
  } catch {
    return false;
  }
}

/**
 * Talks to any OpenAI-compatible `/chat/completions` endpoint (OpenAI, Azure
 * OpenAI gateways, Groq, Together, OpenRouter, vLLM, Ollama, a self-hosted
 * gateway). Everything provider-specific — the wire format, the structured
 * output flag, retry policy — is confined to this file; the rest of the app only
 * knows the `AiProvider` interface.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly label: string;
  readonly mode = "live" as const;

  constructor(private readonly options: OpenAiCompatibleOptions) {
    this.label = `OpenAI-compatible · ${options.model}`;
  }

  async extract({ pages, signal }: ExtractionRequest): Promise<RawExtraction> {
    const body = {
      model: this.options.model,
      // Deterministic transcription, not creative writing. Reasoning models such
      // as openai/gpt-5.6-luna reject `temperature` outright, so it is omitted
      // when configured as `omit` and `seed` carries the determinism instead.
      ...(this.options.temperature !== null
        ? { temperature: this.options.temperature }
        : {}),
      seed: 0,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: buildExtractionUserPrompt(pages) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lab_report_extraction",
          strict: true,
          schema: EXTRACTION_JSON_SCHEMA,
        },
      },
      ...(isOpenRouter(this.options.baseUrl)
        ? {
            // Route only to upstream providers that honour every parameter we
            // send — above all `response_format`. Without this, OpenRouter may
            // pick a provider that silently ignores the JSON schema.
            provider: { require_parameters: true },
          }
        : {}),
    };

    const content = await this.requestWithRetries(body, signal);
    return this.validate(content);
  }

  private async requestWithRetries(
    body: unknown,
    signal: AbortSignal,
  ): Promise<string> {
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        return await this.request(body, signal);
      } catch (error) {
        const appError = error instanceof AppError ? error : null;
        // Transport failures, upstream 5xx and rate limits are worth replaying.
        // A timeout, a bad key, exhausted credits, an unroutable request or an
        // invalid response are not: retrying costs money and cannot help.
        if (!appError || !RETRYABLE.has(appError.code)) throw error;
        lastError = appError;
        if (attempt < this.options.maxRetries) {
          await delay(400 * (attempt + 1), signal);
        }
      }
    }

    throw lastError ?? new AppError("AI_REQUEST_FAILED", "The AI provider request failed.");
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.options.apiKey}`,
    };

    if (isOpenRouter(this.options.baseUrl)) {
      // Attribution only: these appear on the OpenRouter dashboard and are not
      // needed for the call to succeed.
      headers["HTTP-Referer"] = this.options.appUrl;
      headers["X-Title"] = this.options.appTitle;
    }

    return headers;
  }

  private async request(body: unknown, signal: AbortSignal): Promise<string> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${trimSlash(this.options.baseUrl)}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (controller.signal.aborted && !signal.aborted) {
        throw new AppError("AI_TIMEOUT", "The AI provider did not respond in time.", {
          hint: `The request was cancelled after ${Math.round(this.options.timeoutMs / 1000)} seconds.`,
        });
      }
      throw new AppError("AI_REQUEST_FAILED", "The AI provider could not be reached.", {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }

    if (!response.ok) {
      // Mapped from the status code alone. The response body is deliberately
      // never read, parsed, logged or forwarded: a provider may echo the prompt
      // — and therefore report content — back inside an error payload.
      throw errorForStatus(response.status);
    }

    const payload: unknown = await response.json().catch(() => null);
    const content = readMessageContent(payload);

    if (content === null) {
      throw new AppError(
        "AI_INVALID_RESPONSE",
        "The AI provider returned an unexpected response shape.",
      );
    }

    return content;
  }

  private validate(content: string): RawExtraction {
    let json: unknown;
    try {
      json = JSON.parse(stripCodeFence(content));
    } catch {
      throw new AppError("AI_INVALID_RESPONSE", "The AI provider did not return JSON.");
    }

    const parsed = RawExtractionSchema.safeParse(json);
    if (!parsed.success) {
      const paths = issuePaths(parsed.error.issues).slice(0, 5).join(", ");
      throw new AppError(
        "AI_INVALID_RESPONSE",
        "The AI provider response did not match the expected schema.",
        { hint: paths ? `Invalid fields: ${paths}` : undefined },
      );
    }

    return parsed.data;
  }
}

const RETRYABLE = new Set<ErrorCode>(["AI_REQUEST_FAILED", "AI_RATE_LIMITED"]);

/**
 * Maps an upstream status to a typed error. OpenRouter answers 402 when the
 * account is out of credits, 429 when rate limited, and 404 when no provider
 * satisfies the requested parameters — which, given `require_parameters: true`,
 * means the chosen model has no endpoint supporting strict structured output.
 */
function errorForStatus(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError("AI_MISCONFIGURED", "The AI provider rejected the credentials.", {
      hint: "Check that AI_API_KEY is set to a valid key for this provider.",
    });
  }

  if (status === 402) {
    return new AppError(
      "AI_INSUFFICIENT_CREDITS",
      "The AI provider account has insufficient credits.",
      { hint: "Top up the account, then run the analysis again." },
    );
  }

  if (status === 404) {
    return new AppError(
      "AI_STRUCTURED_OUTPUT_UNSUPPORTED",
      "No provider is available for this model with the required options.",
      {
        hint: "The configured model may not support strict structured output. Check AI_MODEL, and set AI_TEMPERATURE=omit if the model does not accept a temperature.",
      },
    );
  }

  if (status === 408 || status === 429) {
    return new AppError("AI_RATE_LIMITED", "The AI provider is rate limiting requests.", {
      hint: "Too many requests were sent in a short period. Wait a moment and try again.",
    });
  }

  return new AppError("AI_REQUEST_FAILED", "The AI provider returned an error.", {
    hint: `The provider responded with HTTP ${status}.`,
  });
}

function issuePaths(issues: Array<{ path: PropertyKey[] }>): string[] {
  return issues.map((issue) => issue.path.map(String).join(".")).filter(Boolean);
}

/** Reads `choices[0].message.content` without trusting the payload shape. */
function readMessageContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;

  // Some gateways return content as an array of parts.
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text: unknown }).text)
          : "",
      )
      .join("");
    return text === "" ? null : text;
  }

  return null;
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new AppError("AI_REQUEST_FAILED", "The request was cancelled."));
      },
      { once: true },
    );
  });
}
