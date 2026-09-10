import "server-only";

import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "@/lib/ai/prompt";
import { AppError } from "@/lib/domain/errors";
import { RawExtractionSchema } from "@/lib/domain/schemas";
import type { AiProvider, ExtractionRequest } from "@/lib/ai/types";
import type { RawExtraction } from "@/lib/domain/schemas";

export type OpenAiCompatibleOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
};

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
      // Deterministic transcription, not creative writing.
      temperature: 0,
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
        // A timeout or an invalid response is not worth replaying; transport and
        // upstream 5xx failures are.
        if (!appError || appError.code !== "AI_REQUEST_FAILED") throw error;
        lastError = appError;
        if (attempt < this.options.maxRetries) {
          await delay(400 * (attempt + 1), signal);
        }
      }
    }

    throw lastError ?? new AppError("AI_REQUEST_FAILED", "The AI provider request failed.");
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
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
        },
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
      // The status is safe to surface; the response body is not, because a
      // provider may echo the prompt (and therefore report content) back.
      throw new AppError("AI_REQUEST_FAILED", "The AI provider returned an error.", {
        hint: `The provider responded with HTTP ${response.status}.`,
      });
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
