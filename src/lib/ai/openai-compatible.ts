import "server-only";

import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserContent,
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
  /** Declared by configuration; see AI_SUPPORTS_IMAGES in .env.example. */
  supportsImages: boolean;
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
  readonly supportsImages: boolean;

  constructor(private readonly options: OpenAiCompatibleOptions) {
    this.label = `OpenAI-compatible · ${options.model}`;
    this.supportsImages = options.supportsImages;
  }

  async extract({ inputs, signal }: ExtractionRequest): Promise<RawExtraction> {
    const body = {
      model: this.options.model,
      // Deterministic transcription, not creative writing. `AI_TEMPERATURE=omit`
      // drops the field entirely for reasoning models that reject it outright.
      //
      // No `seed` is sent. Support for it varies widely between models, and
      // `provider.require_parameters` below makes every parameter in this body a
      // hard routing requirement — so an unsupported `seed` leaves OpenRouter
      // with no eligible provider and fails the whole request with a 404.
      // Temperature is the portable determinism control; seed was only ever a
      // best-effort hint on top of it.
      ...(this.options.temperature !== null
        ? { temperature: this.options.temperature }
        : {}),
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        // Ordered multimodal content: one lead instruction, then labelled text
        // and image blocks in exactly the order the user selected them.
        { role: "user", content: buildExtractionUserContent(inputs) },
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

    /*
     * The timeout has to cover the WHOLE exchange, not just the headers.
     * `fetch` resolves as soon as response headers arrive, and OpenRouter
     * answers 200 immediately while an upstream model is still queued or
     * generating. Clearing the timer at that point would leave the body read
     * unguarded, and a stalled body would hang the request forever.
     */
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    /** True when we aborted on our own timeout rather than the caller leaving. */
    const timedOut = () => controller.signal.aborted && !signal.aborted;

    const timeoutError = () =>
      new AppError("AI_TIMEOUT", "The AI provider did not respond in time.", {
        hint: `The request was cancelled after ${Math.round(this.options.timeoutMs / 1000)} seconds.`,
      });

    try {
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
        if (timedOut()) throw timeoutError();
        throw new AppError("AI_REQUEST_FAILED", "The AI provider could not be reached.", {
          cause: error,
        });
      }

      if (!response.ok) {
        // Discarded without being read: a provider may echo the prompt — and
        // therefore report content — back inside an error payload. Cancelling
        // rather than ignoring it releases the socket instead of leaking it.
        await response.body?.cancel().catch(() => {});
        // Mapped from the status code alone.
        throw errorForStatus(response.status);
      }

      try {
        const payload: unknown = await response.json();
        const content = readMessageContent(payload);

        if (content === null) {
          throw new AppError(
            "AI_INVALID_RESPONSE",
            "The AI provider returned an unexpected response shape.",
          );
        }

        return content;
      } catch (error) {
        if (error instanceof AppError) throw error;
        // A body that stalls mid-stream lands here once the timeout aborts it;
        // anything else at this point is malformed JSON.
        if (timedOut()) throw timeoutError();
        throw new AppError("AI_INVALID_RESPONSE", "The AI provider did not return JSON.");
      }
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
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
