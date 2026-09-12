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
  /** `null` omits the field for models that reject it. */
  temperature: number | null;
  timeoutMs: number;
  maxRetries: number;
  /** OpenRouter dashboard attribution only. */
  appUrl: string;
  appTitle: string;
  supportsImages: boolean;
};

// OpenRouter-only extensions are gated on the host so every other
// OpenAI-compatible endpoint receives a plain, portable body.
function isOpenRouter(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith("openrouter.ai");
  } catch {
    return false;
  }
}

/** Keeps every provider-specific detail behind the `AiProvider` interface. */
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
      // Omitted for models that reject `temperature`. Nothing else optional is
      // sent either: under `require_parameters` every field narrows routing,
      // and an unsupported one (e.g. `seed`) fails the request with a 404.
      ...(this.options.temperature !== null
        ? { temperature: this.options.temperature }
        : {}),
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
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
            // Without this, routing may pick an upstream that silently
            // ignores `response_format`.
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
      headers["HTTP-Referer"] = this.options.appUrl;
      headers["X-Title"] = this.options.appTitle;
    }

    return headers;
  }

  private async request(body: unknown, signal: AbortSignal): Promise<string> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });

    // Must stay armed through the body read: `fetch` resolves on headers, and
    // OpenRouter answers 200 while the model is still generating.
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    /** Our own timeout fired, rather than the caller leaving. */
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
        // Never read: an error payload may echo the prompt, and therefore
        // report content. Cancelling also releases the socket.
        await response.body?.cancel().catch(() => {});
        throw errorForStatus(response.status);
      }

      try {
        // Not `response.json()`: OpenRouter may prepend keep-alive padding
        // while the model generates, and its `:` lines break `JSON.parse`.
        const payload: unknown = parseJsonWithKeepAlivePadding(await response.text());
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
        // A stalled body lands here once the timeout aborts it.
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

// 404 means no upstream satisfies the requested parameters, which under
// `require_parameters: true` usually means unsupported structured output.
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

/** Skips OpenRouter keep-alive padding (blank and SSE-style `:` lines). */
function parseJsonWithKeepAlivePadding(raw: string): unknown {
  const start = raw.search(/[[{]/);
  if (start > 0) {
    const padding = raw.slice(0, start);
    // Strictly padding only, so a proxy error page still fails to parse.
    if (/^(?:\s*(?::[^\n]*)?\n)*\s*$/.test(padding)) {
      return JSON.parse(raw.slice(start));
    }
  }
  return JSON.parse(raw);
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
