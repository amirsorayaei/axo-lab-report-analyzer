# Lab Report Analyzer

[Live app](https://axo-lab-report-analyzer.vercel.app) · [GitHub repository](https://github.com/amirsorayaei/axo-lab-report-analyzer)

A technical challenge implementation for **Axo Longevity**. Upload a laboratory report as a PDF, photo, or screenshot to extract its biomarkers, standardize names and units into English, and classify each result against the ranges printed by the laboratory.

The central design decision is simple: **AI reads and transcribes the report; deterministic TypeScript validates, normalizes, and classifies the results.** The model is never asked to make a medical decision.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zod, `pdfjs-dist`, and `sharp`.

## What the app does

- Accepts ordered PDF, JPEG, PNG, and WebP pages for one patient report
- Extracts available biomarkers, values, units, ranges, and patient context
- Standardizes Spanish and English biomarker names into English
- Normalizes supported units without changing the meaning of a result
- Selects the applicable printed range using the patient's age and sex
- Returns `optimal`, `normal`, `out_of_range`, or `needs_review`
- Presents searchable results with explanations for every status

## How it works

1. The client keeps the selected files in page order and sends one `FormData` request to `POST /api/analyze`.
2. The server validates file count, size, duplicates, MIME type, extension, and byte signature.
3. Text PDFs are parsed on the server with `pdfjs-dist`; visual rows are reconstructed so values stay paired with their units and ranges.
4. Images are rotated, resized, and stripped of metadata with `sharp` before being sent as vision input.
5. The configured AI provider receives the ordered text and image sources and returns strict structured JSON.
6. Zod validates the response as `RawExtraction`. Invalid or incomplete response shapes are rejected.
7. Pure TypeScript standardizes names and units, derives age when necessary, chooses the applicable range, and classifies each biomarker.
8. The API returns a typed success or error response, and the UI renders summaries, filters, details, or a specific recovery action.

```text
Files
  → server validation
  → PDF text extraction / image normalization
  → structured AI transcription
  → Zod validation
  → deterministic normalization and classification
  → typed results UI
```

## Main features

- Ordered multi-file reports, up to eight files per analysis
- Server-side validation with magic-byte checks for every supported format
- Multimodal extraction through an OpenAI-compatible provider interface
- Strict JSON Schema during generation and Zod validation after generation
- Dictionary-first biomarker naming, with model translation only as fallback
- Unit conversion applied equally to the value and every range boundary
- Demographic-aware selection of laboratory reference ranges
- Responsive table and mobile rows, search, status filters, and detail sheets
- Typed errors for upload, processing, configuration, and provider failures
- No database, account, analytics, or report persistence in this challenge

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

### Real AI extraction

The live provider accepts any OpenAI-compatible `/chat/completions` endpoint. This example uses OpenRouter:

```bash
AI_PROVIDER=openai-compatible
AI_API_KEY=<your-key>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemini-2.5-flash-lite
AI_TEMPERATURE=0
AI_TIMEOUT_MS=120000
AI_SUPPORTS_IMAGES=true
```

The example model was validated against the supplied challenge report. A different compatible model can be selected with `AI_MODEL`. See [`.env.example`](.env.example) for optional retry, attribution, and upload settings. The API key remains server-side and `.env.local` is git-ignored.

To inspect the complete UI without using an API key or credits, set `AI_PROVIDER=mock`. Mock mode is clearly labelled and returns bundled sample extraction data. With `AI_PROVIDER=disabled`, the app returns a controlled configuration error instead of silently using fixtures.

Available checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Architecture

```text
src/
├── app/api/analyze/route.ts  Request orchestration and typed response
├── components/analyzer/      Upload, processing, results, and errors
└── lib/
    ├── upload/               Formats, validation, ordering, image preparation
    ├── pdf/extract.ts        Server-side PDF text and row reconstruction
    ├── ai/                   Provider interface, prompt, and output schema
    ├── domain/               Schemas, names, units, and classification
    └── config.ts             Server environment validation
```

- The route handler owns the pipeline: validate → prepare → extract → validate → analyze.
- `AiProvider` isolates provider-specific HTTP behavior from the rest of the application.
- `RawExtraction` contains only facts transcribed from the report. It cannot contain a status.
- `AnalysisResult` is produced by the pure domain layer and is independent of React, Next.js, and the AI provider.
- Client components receive a typed union and never need to parse provider messages or error strings.

## Classification

The app classifies only against ranges printed in the uploaded report. It does not add external targets or medical thresholds.

| Status | Meaning |
| --- | --- |
| `optimal` | Inside an optimal, target, or recommended range explicitly printed by the lab |
| `normal` | Inside the applicable printed reference range |
| `out_of_range` | Outside the applicable printed reference range |
| `needs_review` | The result cannot be compared safely because required data is missing, incompatible, non-numeric, or ambiguous |

`needs_review` is a deliberate safety extension to the three requested statuses. It prevents an unresolved result from being incorrectly presented as normal.

Classification follows these rules:

- Age is taken from the report or derived from date of birth and report date.
- A range is applicable only when all of its stated age and sex conditions match.
- When several ranges apply, the most demographically specific one wins.
- If equally specific ranges disagree, the result becomes `needs_review`.
- Unit conversion uses the same factor for the measured value and all range boundaries, so conversion cannot flip a status.
- Analyte-specific molar conversions are not guessed; unsupported units remain unchanged and can still be compared with matching printed ranges.

Every classified biomarker includes a reason and its applied range, which are visible in the detail sheet.

## Supported files

| | Limit |
| --- | --- |
| Formats | PDF, JPEG/JPG, PNG, WebP |
| Files | 8 per analysis |
| Per file | 10 MB by default |
| Combined upload | 30 MB |
| Scope | One report for one patient |

Files keep the order in which the user selected them. One invalid file rejects the entire request rather than producing a partial analysis.

## Reliability and privacy

- API credentials are read only from server-side environment variables.
- Uploaded bytes, extracted text, normalized images, and results live only for the request lifetime; nothing is persisted.
- PDF bytes remain on the application server. Only extracted PDF text is sent to the AI provider.
- Images are sent to the provider only after EXIF, GPS, thumbnails, and other metadata have been removed.
- Provider requests use a timeout, selective retries, strict structured output, and typed HTTP error mapping.
- Report content, file names, provider error bodies, and PHI are not written to server logs.

This is a technical demonstration, not a compliance-certified system or medical device. Output is informational only and is not medical advice.

## Current limitations

- Scanned or image-only PDFs have no usable text layer and are rejected. Their pages can be uploaded as images instead.
- Extraction accuracy depends on the configured model; a transcription mistake can produce an incorrect classification.
- Very unusual layouts may not preserve every value-to-range relationship during PDF row reconstruction.
- Detection of files belonging to different patients relies on the model and is a safety net, not a guarantee.
- There is no authentication, saved history, export, or persistence. Each analysis is standalone.

The UI exposes the original value, unit, source page, confidence, applied range, and classification reason so the result can be checked against the report.

## Cloud resources for production

The current demo runs on Vercel and processes one report inside a Node.js request without storing it. If this became a production healthcare workflow, long-running work and sensitive data would need explicit infrastructure and governance.

| Need | Example resource | Purpose |
| --- | --- | --- |
| Web application and API | Vercel Functions or a containerized Node service | Run the Next.js UI and protected API |
| Temporary uploads | Private S3 or equivalent object storage with encryption and short retention | Avoid large files living inside one request |
| Background processing | SQS with Lambda/ECS workers, or an equivalent queue | Process large reports outside request timeouts |
| OCR for scanned PDFs | AWS Textract or Google Cloud Vision | Extract text from image-only documents |
| Job and result metadata | Encrypted PostgreSQL | Track authorized processing state and results |
| Secrets and monitoring | Secrets Manager/KMS with PHI-safe logs and metrics | Protect credentials and observe failures without recording reports |

These resources are a production proposal only; they are not implemented in this challenge.

---

Built for the Axo Longevity technical challenge. Informational tool only; not a diagnosis or medical advice.
