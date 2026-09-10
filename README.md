# Lab Report Analyzer

Upload a laboratory report — a PDF, photos, or screenshots — and get every biomarker extracted, standardized into English names and units, and classified against the reference ranges printed on that report.

Built as a technical challenge implementation for **Axo Longevity**.

## Overview

Laboratory reports are dense, multi-column documents, often not in English, and every lab formats them differently. Reading one means manually matching each value to its unit and its reference range, then working out whether it sits inside that range.

This app does that mechanically. The user uploads the pages of one report, the server extracts the printed facts, and the app classifies each result **using only the ranges the report itself prints**. No thresholds, targets, or interpretations are added.

The core design decision is where the AI stops. An AI model transcribes the document; all normalization and classification happen deterministically in TypeScript. The same report always produces the same statuses, and every status can be explained in one sentence. See [AI extraction vs. deterministic logic](#ai-extraction-vs-deterministic-logic).

**Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui + Radix, lucide-react, Zod, `pdfjs-dist`, `sharp`.

## Features

- Upload PDFs, JPEG, PNG or WebP — up to 8 files, treated as the ordered pages of **one report for one patient**
- Server-side PDF text extraction with `pdfjs-dist`, rebuilding visual rows so column relationships survive
- Image normalization with `sharp`: EXIF orientation applied, all metadata stripped, longest side capped at 2400px
- Multimodal AI extraction — PDF text and images sent as one ordered message when the configured model supports images
- Strict JSON-schema response format, validated with Zod before anything is used
- Biomarker name standardization (Spanish/English → English) via a curated dictionary, with the model's translation as fallback
- Unit standardization with a conversion factor applied to the value *and* its ranges together
- Patient extraction (age or date of birth, sex, lab, report date, report ID) and reference/optimal range extraction
- Deterministic classification into `optimal`, `normal`, `out_of_range`, `needs_review`
- Results view with summary counts that double as filters, text search, an empty state, and a per-biomarker detail sheet
- Responsive: a table on wide screens, full-width touch rows below `lg`
- Mock/demo mode that runs the whole pipeline without an API key or credits
- Typed error codes end to end, each with a specific message and next step

## Quick start

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

**Demo mode** — explore the full UI with no API key and no credits. It validates and prepares your files, then returns a bundled sample extraction, clearly labelled in the UI:

```bash
# .env.local
AI_PROVIDER=mock
```

**Live provider** — any OpenAI-compatible `/chat/completions` endpoint. OpenRouter shown here:

```bash
# .env.local
AI_PROVIDER=openai-compatible
AI_API_KEY=<your-key>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=<provider/model-id>
AI_TEMPERATURE=0
AI_SUPPORTS_IMAGES=true
```

The default (`AI_PROVIDER=disabled`) makes analysis return a controlled `AI_NOT_CONFIGURED` error, so the app installs, builds and runs with no provider configured. `.env.local` is git-ignored.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`.

## Supported files and limits

| | |
| --- | --- |
| Formats | PDF, JPEG/JPG, PNG, WebP |
| Files per analysis | 8 (`MAX_FILES`) |
| Per file | 10 MB (`MAX_UPLOAD_SIZE_MB`, configurable) |
| Combined | 30 MB (`MAX_TOTAL_UPLOAD_BYTES`) |
| Scope | One patient, one report |

Files keep the order the user selected — that order is the page order sent to the model. Every file is validated independently by extension, MIME type, byte signature and size; any invalid file rejects the whole request rather than silently analysing a partial report.

**Scanned PDFs are not supported.** PDFs are read locally and never uploaded to the provider, so a PDF with no text layer fails with `PDF_TEXT_EXTRACTION_FAILED`. There is no OCR. The workaround, which the error message states, is to upload photos or screenshots of the pages instead — those go to the vision model as images.

## User flow

1. User selects or drags one or more files; they appear as an ordered, editable list.
2. The server validates count, combined size, duplicates, and each file's extension, MIME type, signature and size.
3. PDFs are extracted to text page by page; images are normalized and encoded for vision input.
4. All sources are sent to the AI provider as one ordered multimodal message.
5. The response is parsed and validated against the Zod extraction schema; a mismatch is rejected, not partially rendered.
6. The app standardizes biomarker names and units, and derives age from date of birth when needed.
7. Each biomarker is classified deterministically against the report's own ranges and the patient context.
8. Results render with summary counts, search, status filtering, and a detail sheet per biomarker.

## Architecture

```
src/
├── app/
│   ├── api/analyze/route.ts     POST /api/analyze — the only server entry point
│   └── page.tsx                 Server component shell
├── components/analyzer/         Feature UI (client)
├── components/ui/               shadcn/ui primitives
└── lib/
    ├── upload/                  Formats, limits, validation, image normalization
    ├── pdf/extract.ts           pdfjs text extraction
    ├── ai/                      Provider abstraction, prompt, JSON schema
    ├── domain/                  Zod schemas, units, names, classification
    └── config.ts                Zod-validated server environment
```

- **Route handler** orchestrates the pipeline: validate → normalize into ordered sources → provider → validate → analyze. It is the only place that touches uploaded bytes.
- **Client** is a small state machine (`analyzer-shell.tsx`) covering upload, selected files, processing, results and error states. It holds files in memory only for the duration of the request.
- **Provider abstraction** — `AiProvider` has one method. `DisabledAiProvider`, `MockAiProvider` and `OpenAiCompatibleProvider` are chosen by environment. There is no fallback path: a missing key errors rather than quietly serving fixture data.
- **Domain layer** is pure and framework-free — no I/O, no React, no provider knowledge — which is what makes classification auditable.
- **Server/client separation:** every module that can touch secrets or the filesystem imports `server-only`, so importing one from a client component is a build error.

## AI extraction vs. deterministic logic

The model has exactly one job: **transcribe what is printed**. It never returns a status, never converts a unit, and never supplies a threshold — it is not even asked to.

Two schema layers enforce this. `RawExtraction` is what a provider may return: original names, original values, original units, printed ranges. `AnalysisResult` is what the app computes from it. The model cannot influence a status except through the facts it transcribed.

Everything below is done in TypeScript, not by the model:

- **Name standardization** — curated dictionary first, model's translation second, original name last. The source is recorded and the original name is always shown.
- **Unit standardization** — the conversion factor is applied to the value *and* to every range bound together, so a biomarker can never change status because of a conversion. Molar conversions (`mg/dL` ↔ `mmol/L`) are deliberately not implemented; they need an analyte-specific molar mass, which is medical knowledge this app must not invent. Such units pass through unchanged and remain classifiable against their own printed range.
- **Age derivation** — computed from date of birth and report date. Arithmetic, not inference.
- **Range matching** — a range applies when every demographic condition it states is satisfied; the most specific applicable range wins.
- **Classification**, in this order:

| # | Condition | Status |
| --- | --- | --- |
| 1 | No parsable numeric value (e.g. `Positivo`, `<0,2`) | `needs_review` |
| 2 | Value and range units disagree after standardization | `needs_review` |
| 3 | No usable range printed | `needs_review` |
| 4 | An applicable range needs an age or sex the report did not state | `needs_review` |
| 5 | Several equally specific ranges apply and disagree | `needs_review` |
| 6 | Inside an applicable **optimal** range | `optimal` |
| 7 | Inside an applicable **reference** range | `normal` |
| 8 | Outside an applicable **reference** range | `out_of_range` |

`needs_review` exists so the app never guesses. If the report gives no range, the value is not numeric, or the applicable range is ambiguous, the result is surfaced as unresolved rather than assumed fine. Every status carries a one-sentence reason built from the same facts, visible in the detail sheet.

`optimal` appears only where a report explicitly prints an optimal, target or recommended range. Many reports print none, in which case that count is legitimately zero.

**This is informational only. It is not a diagnosis and not medical advice.**

## AI provider configuration

All server-side. No variable is prefixed with `NEXT_PUBLIC_`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `disabled` | `disabled` \| `mock` \| `openai-compatible` |
| `AI_API_KEY` | — | Bearer token; required for `openai-compatible` |
| `AI_BASE_URL` | — | e.g. `https://openrouter.ai/api/v1` |
| `AI_MODEL` | — | Model id, passed through unchanged |
| `AI_TEMPERATURE` | `0` | A number, or `omit` to send no temperature field |
| `AI_SUPPORTS_IMAGES` | `true` | Declared, not probed; `false` refuses image uploads before a request is spent |
| `AI_TIMEOUT_MS` | `60000` | Per-request timeout |
| `AI_MAX_RETRIES` | `1` | Retries for transport, 5xx and rate-limit failures only |
| `AI_APP_URL` / `AI_APP_TITLE` | localhost / app name | Optional OpenRouter attribution headers |
| `MAX_UPLOAD_SIZE_MB` | `10` | Per-file upload limit |

OpenRouter works through the `openai-compatible` provider; requests to an `openrouter.ai` base URL additionally send `provider: { require_parameters: true }` so routing only reaches upstreams that honour the strict JSON schema. Every other endpoint receives a plain, portable request body.

**Model capability matters.** The chosen model must support strict structured output, and must accept image input if images are uploaded. Support for individual request parameters also varies by model — with `require_parameters` enabled, sending a parameter the model does not accept can leave no eligible provider. Check the model's parameter list before configuring it.

## Error handling

Every failure resolves to one typed code. The API always answers `{ ok: true, data } | { ok: false, error: { code, message, hint? } }`, and the UI maps each code to a title, an explanation and a next step.

- **Selection** — no files, too many, combined size exceeded, duplicate file
- **Per file** — unsupported format, empty, too large, signature mismatch for PDF or image
- **Processing** — corrupted PDF, corrupted image, PDF with no extractable text
- **Extraction** — no lab data found, sources that appear to be different patients
- **Configuration** — provider disabled, missing settings, model without image support
- **Provider** — timeout, rate limited, insufficient credits, unroutable structured-output request, transport failure, response failing schema validation

Upstream failures are classified from the HTTP status code alone. The provider's error body is never read, logged or forwarded, because a provider may echo the prompt — and therefore report content — back inside an error payload.

## Privacy and safety

- The API key is a server-side environment variable and never reaches the browser. The browser talks only to `/api/analyze`.
- Uploaded bytes, extracted text, normalized image data and the analysis exist only for the lifetime of the request. There is no database, object storage, cache, session or analytics in this application.
- Image metadata — EXIF, GPS, ICC, thumbnails — is stripped during normalization before anything is sent to a provider.
- Text PDFs are read locally; only extracted text is sent. Images are necessarily sent to the provider, which is a larger disclosure.
- Only error codes are logged. Messages may quote report content, so they are returned to the caller but not written to logs.

**No compliance claim is made.** This is a technical demonstration, not a certified product, and nothing here should be read as GDPR, HIPAA or medical-device conformance. Using it with real patient data would require, at minimum, a data processing agreement with the AI provider, a lawful basis, access control, and a clinical review of the classification rules. Output is informational only and is not a diagnosis or medical advice.

## Current limitations

- **No OCR.** Scanned or image-only PDFs are rejected; photos and screenshots must be uploaded as images instead.
- **Extraction quality is the model's.** A mis-transcribed value produces a confidently wrong status. The detail sheet shows the model's self-reported confidence, source page and everything as printed, so a result can be checked against the original — mitigation, not a guarantee.
- **Model-dependent.** Behaviour varies by model; free-tier models in particular are subject to queuing and rate limits, and a large strict-JSON payload can exceed `AI_TIMEOUT_MS`.
- **Unusual layouts.** Row reconstruction is tuned for common report layouts. Heavily non-standard formatting may pair values with the wrong range or be skipped.
- **Conflicting-patient detection is model-reported**, so it is a safety net rather than a guarantee.
- **Duplicate detection is metadata-based** (name, size, type); the same page saved under two names is not caught before upload.
- **No accounts, no history, no export, no persistence, and no deployment.** Each analysis is standalone.
- **No automated test suite.** The domain layer is pure and framework-free specifically so unit tests would be straightforward to add.

## Production considerations

Not deployed. Before this handled real patient data it would need: authentication and per-user authorization; a secure storage strategy with encryption and a short retention policy if persistence is ever introduced; background/async processing so long reports are not bound to a single request timeout; provider monitoring, retries and fallbacks; observability that records request outcomes without recording report content; rate limiting and upload abuse controls; and a privacy and clinical review of both the data flow and the classification rules.

---

Informational tool only. Not a medical device and not medical advice.
