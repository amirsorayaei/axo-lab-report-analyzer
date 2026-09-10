# Lab Report Analyzer

A single-page web tool that turns a laboratory PDF report into a structured,
standardized, classified list of biomarkers.

Upload a PDF, and the app extracts every result it can find, translates the
biomarker names and units into a consistent English vocabulary, and labels each
result as **optimal**, **normal**, **out of range** or **needs review** — using
nothing but the patient facts and the ranges that are printed on that report.

Built for the Axo Longevity technical challenge.

---

## Table of contents

- [Challenge interpretation](#challenge-interpretation)
- [Features and user flow](#features-and-user-flow)
- [Architecture and data flow](#architecture-and-data-flow)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [AI provider modes](#ai-provider-modes)
- [PDF processing and the structured schema](#pdf-processing-and-the-structured-schema)
- [Normalization and classification rules](#normalization-and-classification-rules)
- [Error handling](#error-handling)
- [Privacy and security](#privacy-and-security)
- [Manual QA checklist](#manual-qa-checklist)
- [Limitations and tradeoffs](#limitations-and-tradeoffs)
- [Production architecture on AWS](#production-architecture-on-aws)

---

## Challenge interpretation

The brief asks for an AI-powered lab report analyzer. The interesting question is
not "can an LLM read a PDF" — it is **where the boundary between the model and the
application sits** when the output is health information.

The line drawn here:

| Concern | Owner | Why |
| --- | --- | --- |
| Reading text out of the PDF | `pdfjs-dist`, deterministic | No inference needed |
| Transcribing what is printed (names, values, units, ranges) | AI provider | Layout and language vary too much for regex |
| Translating biomarker names | Curated dictionary first, model second | Auditable and stable across runs |
| Standardizing units | Deterministic table in TypeScript | A conversion factor is not a judgement call |
| Deriving age from a date of birth | Deterministic | Arithmetic, not inference |
| **Deciding optimal / normal / out of range** | **Deterministic** | **A status is a claim about someone's health** |

The model is a transcription tool. It never returns a status, never converts a
unit, and never supplies a threshold. It is not even asked to. Everything a user
sees as a verdict is computed in `src/lib/domain/classify.ts` from facts the
report itself printed, which means the same report always produces the same
statuses and every status can be explained in one sentence.

A consequence worth stating up front: **this app never adds medical knowledge**.
If a report prints no reference range for a biomarker, the result is
`needs_review` — not "probably fine".

---

## Features and user flow

**1. Upload** — drag-and-drop or file picker, with the size limit shown up front.

**2. Selected file** — name, size, remove, and an explicit *Analyze report*
action. Nothing is uploaded until the user asks for it.

**3. Processing** — four honest stages that mirror what the server actually does:
validating, extracting text, analyzing, normalizing. The client cannot observe
server-side progress, so transitions are time-based estimates and the last stage
stays busy until the response arrives. No stage is ever reported as complete
based on a guess.

**4. Results**
- Report summary: patient age (with a note when it was derived from a date of
  birth), sex, laboratory, report date, report id, page count, detected language.
- Five count cards: total, optimal, normal, out of range, needs review.
- A searchable, status-filterable biomarker table showing the standardized name
  with the original name underneath, the result in the standardized unit, the
  reference range, and a status badge.
- A detail Sheet per biomarker: the value, why it got its status in plain
  language, everything as printed on the report, all reference and optimal
  ranges with the applied one marked, transcription confidence, source page and
  any report footnotes.
- *Analyze another report* to start over.
- A medical disclaimer that is always visible.

**5. Errors** — every failure is a typed code with a human title, an explanation
and a next step. See [Error handling](#error-handling).

---

## Architecture and data flow

```
Browser                          Server (Route Handler)              Provider
───────                          ──────────────────────              ────────
 select PDF
 POST multipart  ──────────────▶ validate
                                   extension · MIME · size
                                   · %PDF- signature
                                 extractPdfText()
                                   pdfjs-dist, page by page,
                                   layout-aware line rebuild
                                 getAiProvider()  ────────────────▶  transcribe
                                                                     (JSON only)
                                 RawExtractionSchema.parse()  ◀────  structured JSON
                                 analyzeExtraction()
                                   name standardization
                                   unit standardization
                                   age derivation
                                   classification
 render results  ◀────────────── AnalyzeResponse (JSON)
```

Nothing on this path is written to disk, a database, a cache or a log.

### Project layout

```
src/
├── app/
│   ├── api/analyze/route.ts        POST /api/analyze — the only server entry point
│   ├── page.tsx                    Server component shell
│   └── globals.css                 Design tokens (palette + status colours)
├── components/
│   ├── analyzer/                   Feature components (client)
│   └── ui/                         shadcn/ui primitives
└── lib/
    ├── ai/                         Provider abstraction (server only)
    │   ├── types.ts                AiProvider interface
    │   ├── provider.ts             Environment-driven factory
    │   ├── disabled.ts             Safe default
    │   ├── mock.ts                 Demo provider
    │   ├── openai-compatible.ts    Live provider
    │   ├── prompt.ts               System prompt + JSON schema
    │   └── fixtures/               Sample extraction for demo mode
    ├── domain/                     Pure, deterministic, framework-free
    │   ├── schemas.ts              Zod contracts + domain types
    │   ├── classify.ts             The classification engine
    │   ├── units.ts                Unit standardization table
    │   ├── biomarker-names.ts      Name dictionary
    │   ├── analyze.ts              Orchestration
    │   └── errors.ts               Typed error codes
    ├── pdf/                        extract.ts, validate.ts (server only)
    ├── config.ts                   Validated server environment (server only)
    ├── api-types.ts                Shared request/response contract
    └── status-presentation.ts      Status → label/colour, shared by all views
```

**Server/client separation.** Every module that can touch secrets, the filesystem
or the provider imports `server-only`, so importing one from a client component
is a build error rather than a leak. The client and the server share exactly two
things: the response type in `api-types.ts` and the pure domain types.

### Key decisions

- **Two schema layers.** `RawExtraction*` is what a provider may return: pure
  transcription. `Analysis*` is what the app computes from it. The model cannot
  influence a status except through the facts it transcribed.
- **Providers are interchangeable and never implicit.** `AiProvider` has one
  method. There is no fallback path anywhere: a missing key produces
  `AI_NOT_CONFIGURED`, a broken live provider produces `AI_MISCONFIGURED`.
  Silently serving fixture data as if it were a real analysis would be the single
  most dangerous bug this app could have.
- **Typed errors end to end.** One `AppError` type with a fixed code union, one
  response shape, one presentation map in the UI.
- **No persistence layer at all**, rather than a persistence layer that is
  configured to delete things.

---

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

`.env.example` is preconfigured for OpenRouter and ships with `AI_API_KEY`
deliberately empty, so after copying it you only need to add your key:

```bash
# .env.local
AI_API_KEY=sk-or-v1-...
```

`.env.local` is git-ignored and must never be committed.

**No key, no credits, no problem.** To explore the whole app without spending
anything, switch to demo mode — it returns the bundled sample extraction and
labels itself clearly in the UI:

```bash
echo "AI_PROVIDER=mock" >> .env.local
```

Setting `AI_PROVIDER=disabled` instead makes analysis return a controlled
`AI_NOT_CONFIGURED` error. The app installs, builds and runs in every one of the
three modes without an API key.

Other commands:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm start           # serve the production build
```

---

## Environment variables

All server-side. **Nothing here is exposed to the browser** — no variable is
prefixed with `NEXT_PUBLIC_`, and only the derived upload limit (a number of
megabytes) is ever sent to the client.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `disabled` | `disabled` \| `mock` \| `openai-compatible` |
| `AI_API_KEY` | — | Bearer token. Required for `openai-compatible` |
| `AI_BASE_URL` | — | Base URL, e.g. `https://openrouter.ai/api/v1` |
| `AI_MODEL` | — | Model id passed straight through |
| `AI_TEMPERATURE` | `0` | A number, or `omit` to send no temperature field |
| `AI_TIMEOUT_MS` | `60000` | Per-request timeout |
| `AI_MAX_RETRIES` | `1` | Retries for transport, 5xx and rate-limit failures |
| `AI_APP_URL` | `http://localhost:3000` | Optional OpenRouter `HTTP-Referer` attribution |
| `AI_APP_TITLE` | `Axo Lab Report Analyzer` | Optional OpenRouter `X-Title` attribution |
| `MAX_UPLOAD_SIZE_MB` | `10` | Server-enforced upload limit |

Values are validated with Zod at first use. If validation fails, only the
offending **variable names** appear in the error — never their values.
`.env.local` is git-ignored; `.env.example` is committed.

---

## AI provider modes

### `disabled` (default)

```env
AI_PROVIDER=disabled
```

Returns `AI_NOT_CONFIGURED`. The app is fully usable up to the analysis step,
which makes it safe to run, build and deploy with no provider decision made.

### `mock` (demo)

```env
AI_PROVIDER=mock
```

Returns the extraction transcribed from the challenge's own sample report
(`src/lib/ai/fixtures/sample-report.ts`). The uploaded PDF is still validated and
its text is still extracted — only the transcription step is replaced.

The results view shows a prominent amber **"Demo mode — these results are not
from your file"** banner naming the provider. The fixture is parsed through
`RawExtractionSchema` like any other provider response, so demo mode exercises
the real contract rather than bypassing it.

### `openai-compatible` (live) — configured for OpenRouter

```env
AI_PROVIDER=openai-compatible
AI_API_KEY=sk-or-v1-...          # set in .env.local only, never committed
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-5.6-luna
AI_TEMPERATURE=omit
```

Get a key at <https://openrouter.ai/keys>.

#### Why this model

`openai/gpt-5.6-luna` is chosen for **extraction accuracy and reliable strict
structured output**, not for lowest price. A laboratory report is a dense,
multi-column, often non-English document, and this pipeline is deterministic
downstream of the model — a mis-transcribed value becomes a confidently wrong
classification, which is the worst failure mode this app has. Paying slightly
more per report to reduce that risk is the right trade.

Extended reasoning is **not** enabled: no `reasoning` or `reasoning_effort`
parameter is sent, so the model runs at its default. This task is structured
transcription, not multi-step problem solving.

#### `AI_TEMPERATURE=omit` is required for this model

`openai/gpt-5.6-luna` does not accept a `temperature` parameter. Because
requests are sent with `provider: { require_parameters: true }`, OpenRouter only
routes to upstream providers that honour **every** parameter in the request — so
including an unsupported `temperature` can leave no eligible provider and fail
the call. Determinism instead comes from `seed: 0`.

If you switch to a model that does support temperature (for example
`google/gemini-2.5-flash-lite`, which is roughly half the price but a much
smaller model), set `AI_TEMPERATURE=0`.

#### What is sent

```jsonc
POST https://openrouter.ai/api/v1/chat/completions
Content-Type: application/json
Authorization: Bearer ${AI_API_KEY}
HTTP-Referer: http://localhost:3000        // optional attribution
X-Title: Axo Lab Report Analyzer           // optional attribution

{
  "model": "openai/gpt-5.6-luna",
  "seed": 0,
  "messages": [ ... ],
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "lab_report_extraction", "strict": true, "schema": { ... } }
  },
  "provider": { "require_parameters": true }
}
```

`provider.require_parameters` is what makes strict structured output
trustworthy: without it OpenRouter may route to a provider that silently ignores
`response_format` and returns prose, which would fail Zod validation and waste
the call.

The two attribution headers are **optional** — they only label the request on
the OpenRouter dashboard, and the call succeeds without them. Point `AI_APP_URL`
at the real origin in production.

#### Portability

The OpenRouter extensions (the `provider` block and the two headers) are applied
only when `AI_BASE_URL` points at `openrouter.ai`. Every other OpenAI-compatible
endpoint — OpenAI, Azure gateways, Groq, Together, vLLM, Ollama, a self-hosted
gateway — receives a plain, portable request body. No second AI SDK was added;
this is the same `OpenAiCompatibleProvider` the app already had.

#### Switching back to mock mode

```bash
# .env.local
AI_PROVIDER=mock
```

That is the only line that has to change. The mock provider returns the bundled
sample extraction, consumes no credits, and the results view shows a prominent
**Demo mode** banner so its output can never be mistaken for a real analysis.

#### Response handling

The response is treated as untrusted input: markdown fences are stripped, JSON is
parsed defensively, the payload shape is read without assuming it, and the result
is validated with Zod. A mismatch is `AI_INVALID_RESPONSE` — never partially
rendered data.

Adding a provider that is not OpenAI-compatible (Anthropic, Gemini native,
Bedrock) means adding one class implementing `AiProvider` and one `case` in
`src/lib/ai/provider.ts`. Nothing else changes.

> ### ⚠️ Before uploading real patient data
>
> Sending a report to OpenRouter sends its **full text to a third party**, and
> OpenRouter in turn routes it to an upstream model provider. This app does not
> store anything, but that guarantee ends at the network boundary.
>
> Before uploading any real patient health data, review OpenRouter's privacy
> policy, terms and data-retention settings, and the terms of whichever upstream
> provider ends up serving the request. Check in particular whether prompts are
> logged or used for training, and configure your account's data policy
> accordingly. Depending on your jurisdiction you will also need a data
> processing agreement in place.
>
> Use demo mode (`AI_PROVIDER=mock`) for demonstrations. This app makes no
> compliance claim of any kind — see [Privacy and security](#privacy-and-security).

---

## PDF processing and the structured schema

### Validation

Four checks, cheapest first — extension, MIME type, size, then the `%PDF-` file
signature. The first three are client-supplied and therefore untrusted; the
signature check is the one that actually decides.

### Text extraction

`pdfjs-dist` (legacy build, no DOM) reads the document page by page, preserving
page numbers so every biomarker can cite its source page.

Raw pdfjs text items arrive unordered and ungrouped, which destroys the column
layout that makes a lab report readable. The extractor rebuilds visual rows:
items are sorted top-to-bottom, grouped into rows by baseline, and joined
left-to-right with whitespace proportional to the horizontal gap. Laboratory
reports typically print the value, unit and range a couple of points *above* the
biomarker name they belong to, so rows are grouped against the previous item's
baseline (with a total row-span cap) rather than the first item's.

The result for the sample report:

```
Hematíes            4,73    x10 /mm³      [    4,1 - 5,75   ]
Hemoglobina         13,9    g/dL          [   12,5 - 17,2   ]
Colesterol total ü  209 *   mg/dL         [        <  200   ]
```

If a document yields fewer than 200 non-whitespace characters it is treated as a
scan and rejected with `PDF_TEXT_EXTRACTION_FAILED`.

**OCR extension point.** OCR would slot in at exactly one place: in
`extractPdfText`, where that threshold is checked. The natural production shape
is to render the page to an image and hand it to a hosted OCR service (AWS
Textract, Google Document AI) or a WASM Tesseract build, then feed the recovered
text into the same page array. Everything downstream — provider, validation,
classification, UI — is unchanged, because it only ever sees `{ pageNumber, text }`.
It is not implemented here: it is a meaningful cost, latency and accuracy
decision, and pretending to do it badly would be worse than declining.

### Structured schema

The provider must return this shape (`src/lib/domain/schemas.ts`):

```ts
{
  reportLanguage: string | null,
  patient: {
    ageYears, dateOfBirth, sex, reportDate,
    collectionDate, laboratoryName, reportId      // all nullable
  },
  biomarkers: [{
    originalName: string,
    standardizedNameSuggestion: string | null,
    panel: string | null,
    originalValue: string,          // exactly as printed
    numericValue: number | null,    // null for "Positivo", "<0,2", "A"
    originalUnit: string | null,
    referenceRanges: Range[],
    optimalRanges: Range[],         // only when the report labels them so
    sourcePage: number,
    confidence: number,             // transcription confidence, 0..1
    notes: string | null            // report footnotes, verbatim
  }]
}

Range = {
  text: string,                     // as printed, e.g. "[ 4,1 - 5,75 ]"
  min: number | null,
  max: number | null,
  minInclusive: boolean,            // false only for a strict < or >
  maxInclusive: boolean,
  unit: string | null,
  appliesToSex: "male" | "female" | null,
  appliesToAgeMinYears: number | null,
  appliesToAgeMaxYears: number | null
}
```

The same schema is expressed as JSON Schema for providers that support structured
output, but the Zod schema stays the authority: whatever comes back is validated
against it regardless of what the provider promised.

---

## Normalization and classification rules

### Biomarker names

1. A curated Spanish/English dictionary (`biomarker-names.ts`), matched against
   the full printed name, then the name without the assay method ("por HPLC"),
   then without specimen qualifiers ("(suero/plasma)"). This ordering keeps real
   distinctions — HbA1c *(NGSP)* and *(IFCC)* stay separate biomarkers.
2. Otherwise the model's English suggestion.
3. Otherwise the original name.

The source is recorded per biomarker and surfaced in the detail Sheet, and the
original name is always shown next to the standardized one. Nothing is silently
rewritten.

### Units

`units.ts` maps each printed unit to a canonical symbol plus a linear factor.
Most entries are notation aliases with factor 1 — `x10³/mm³` and `10^3/µL` are the
same quantity, because 1 mm³ = 1 µL.

**Classification is invariant under this step.** The factor is applied to the
value *and* to every range bound together, so a biomarker can never change status
because of a conversion. The conversion exists so the UI can present one
consistent unit vocabulary, and `conversionApplied` is true only when the
magnitude actually changed.

Two kinds of conversion are deliberately **not** implemented:

- **Molar conversions** (`mg/dL ↔ mmol/L`) need an analyte-specific molar mass.
  That is medical knowledge, and inventing it is exactly what this app must not
  do. Such units pass through unchanged and remain classifiable against their own
  printed range.
- **Rescalings between two conventional units** (`mg/L ↔ mg/dL`, `g/L ↔ g/dL`)
  would trade one familiar unit for another with no gain — CRP is conventionally
  reported in mg/L, and converting it would only surprise the reader.

A result whose value could not be parsed as a number keeps its **original** unit
in the UI, because pairing a censored value like `<0,2` with a converted unit
would imply a conversion that never happened.

### Age

If the report prints an age, it is used. If it prints a date of birth, the age is
computed in TypeScript from the date of birth and the report date — arithmetic,
not inference. The UI marks derived ages explicitly. The sample report prints
`F. Nac.: 13/02/1978` with a report date of `23/02/2026`, and the app shows
*48 years (derived from date of birth)*.

### Classification

`classifyBiomarker()` decides in this order:

| # | Condition | Status |
| --- | --- | --- |
| 1 | No parsable numeric value (`Positivo`, `A`, `<0,2`) | `needs_review` |
| 2 | Value unit and range unit disagree after standardization | `needs_review` |
| 3 | No usable range printed at all | `needs_review` |
| 4 | An applicable range needs an age or sex the report did not state | `needs_review` |
| 5 | Several equally specific ranges apply and disagree about this value | `needs_review` |
| 6 | Inside an applicable **optimal** range | `optimal` |
| 7 | Inside an applicable **reference** range | `normal` |
| 8 | Outside an applicable **reference** range | `out_of_range` |

**Range applicability.** A range applies when every demographic condition it
states is satisfied. A range with no stated condition applies to everyone. When
several ranges apply, the most demographically specific ones win (sex is more
specific than age, both are more specific than none).

**On the "missing age or sex" rule.** The brief lists a missing age or sex as a
`needs_review` trigger. Taken literally that would flag every biomarker on a
report that omits either, including biomarkers whose range is not demographic at
all — which is noise, not caution. The rule implemented is the one that carries
the intent: *a missing fact matters when it is needed to choose a range*. If a
biomarker has sex-specific ranges and the report gives no sex, the result is
`needs_review`, because the app genuinely cannot tell which range applies. If the
report prints one range for everyone, a missing age changes nothing and the
result is classified. This is the only place the implementation deviates from a
literal reading of the brief, and it deviates towards fewer false alarms without
ever guessing.

**Bounds.** `[ 4,1 - 5,75 ]` is inclusive on both ends. `[ < 200 ]` is a strict
upper bound. `[ > 40 ]` is a strict lower bound. Inclusivity comes from the
operator the report printed, never from a default.

Every status carries a one-sentence reason built from the same facts, e.g.
*"209 mg/dL is above the reference range printed on the report (< 200 mg/dL)."*

**Worked example — the sample report's lipid panel.** The report prints
cardiovascular-risk target values under *Colesterol LDL* and explicitly calls
them recommended, so they are transcribed as optimal ranges (`< 55`, `< 70`,
`< 100`, `< 116 mg/dL`). The report does not assign a risk category to this
patient. With a result of 149 mg/dL the tiers all agree — the value is outside
every one of them — so the classifier proceeds to the printed reference range
`< 116` and returns `out_of_range`. Had the result been 95 mg/dL the tiers would
have disagreed, and the app would have returned `needs_review` rather than
picking a risk category on the patient's behalf. That is the intended behaviour.

---

## Error handling

Every failure resolves to exactly one typed code. The API always answers with
`{ ok: true, data } | { ok: false, error: { code, message, hint? } }`.

| Code | HTTP | Cause | What the user sees |
| --- | --- | --- | --- |
| `INVALID_FILE_TYPE` | 415 | Not a `.pdf`, wrong MIME, or no file field | "That file is not a PDF" |
| `EMPTY_FILE` | 400 | Zero bytes | "The file is empty" |
| `FILE_TOO_LARGE` | 413 | Over `MAX_UPLOAD_SIZE_MB` | Limit and actual size |
| `INVALID_PDF_SIGNATURE` | 415 | Missing `%PDF-` header | "This file is not a valid PDF" |
| `PDF_CORRUPTED` | 422 | pdfjs could not open it | "Damaged, encrypted or password protected" |
| `PDF_TEXT_EXTRACTION_FAILED` | 422 | Scan / image-only PDF | Explains OCR is not enabled and asks for a text PDF |
| `AI_NOT_CONFIGURED` | 503 | `AI_PROVIDER=disabled` | How to enable demo mode |
| `AI_MISCONFIGURED` | 500 | Live provider missing settings | Which variables are missing |
| `AI_MISCONFIGURED` | 500 | Provider returned 401/403 — bad or missing key | "Check that `AI_API_KEY` is valid" |
| `AI_TIMEOUT` | 504 | Provider exceeded `AI_TIMEOUT_MS` | "Try again in a moment" |
| `AI_RATE_LIMITED` | 429 | Provider returned 429/408 | "Too many requests right now" |
| `AI_INSUFFICIENT_CREDITS` | 402 | OpenRouter account out of credits | "Top it up and try again" |
| `AI_STRUCTURED_OUTPUT_UNSUPPORTED` | 502 | Provider returned 404 — no route satisfies the required parameters | "The configured model cannot return structured output" |
| `AI_REQUEST_FAILED` | 502 | Transport failure or upstream 5xx | "Try again in a moment" |
| `AI_INVALID_RESPONSE` | 502 | Not JSON, or failed Zod validation | Explains it was rejected, not shown |
| `INTERNAL_ERROR` | 500 | Anything unexpected | Generic message |

Retries apply to `AI_REQUEST_FAILED` and `AI_RATE_LIMITED` only. A timeout, a bad
key, exhausted credits, an unroutable request or an invalid response are not
replayed — retrying those costs money and cannot help.

Upstream failures are classified **from the HTTP status code alone**. The
provider's error body is never read, parsed, logged or forwarded, because a
provider may echo the prompt — and therefore report content — back inside an
error payload. The error panel
offers *Try again* (same file) and *Choose another file*, and shows the error
code so a user can quote it without pasting any report content.

---

## Privacy and security

**What the app does**

- All processing happens on the server. The browser never talks to an AI
  provider, and the API key never leaves the server.
- The PDF bytes, the extracted text and the analysis exist only for the lifetime
  of the request. There is no database, no object storage, no cache, no
  session, no analytics and no telemetry.
- Only the error *code* is logged, and only for unexpected failures. Error
  messages can quote report text, so they are returned to the caller but never
  written to a log. pdfjs verbosity is set to zero so font warnings cannot write
  document-derived noise into the logs either.
- Configuration errors report variable *names*, never values. Provider error
  bodies are never echoed to the client, because a provider may reflect the
  prompt — and therefore report content — back in an error.
- Every input is validated: the upload (extension, MIME, size, signature), the
  environment (Zod), and the model response (Zod).
- No `NEXT_PUBLIC_` variable exists. Server-only modules import `server-only`, so
  a bad import fails the build.

**What the app does not claim**

This is a technical demonstration, not a certified product. It is **not** a
medical device, and no claim is made about GDPR, HIPAA, ISO 13485, IVDR or any
other compliance regime. Running it on real patient data in production would
require, at minimum: a data processing agreement with the AI provider covering
zero data retention, a lawful basis and privacy notice, access control and
authentication, audit logging that records access without recording content,
encryption in transit and at rest for anything that does get stored, a documented
retention policy, and a clinical review of the classification rules.

The medical disclaimer is visible in the upload state, in the results state and
in the page footer.

---

## Manual QA checklist

Run `npm run dev`, then work through these.

**Provider modes**

- [ ] `AI_PROVIDER=disabled` → upload a valid PDF → `AI_NOT_CONFIGURED` panel
      explaining how to enable demo mode.
- [ ] `AI_PROVIDER=mock` → upload any valid text PDF → results render, and the
      amber **Demo mode** banner is visible above them.
- [ ] `AI_PROVIDER=openai-compatible` with no other variables set →
      `AI_MISCONFIGURED` listing `AI_API_KEY, AI_BASE_URL, AI_MODEL`.
- [ ] OpenRouter configured but `AI_API_KEY` left empty → `AI_MISCONFIGURED`
      listing only `AI_API_KEY`.
- [ ] With a real OpenRouter key → results render, **no** demo banner, provider
      label reads `OpenAI-compatible · openai/gpt-5.6-luna`.
- [ ] With a deliberately invalid key → "The AI provider rejected the
      credentials", and the key never appears in the response or the server log.
- [ ] Switching `AI_PROVIDER` back to `mock` restores demo mode with no other
      change and no credit spend.

**Upload validation**

- [ ] A `.txt` file → "That file is not a PDF".
- [ ] A `.txt` file renamed to `.pdf` → "This file is not a valid PDF"
      (`INVALID_PDF_SIGNATURE`).
- [ ] A zero-byte file → "The file is empty".
- [ ] A file larger than `MAX_UPLOAD_SIZE_MB` → limit and actual size shown.
- [ ] A truncated or random-bytes PDF → "The PDF could not be opened".
- [ ] An image-only / scanned PDF → `PDF_TEXT_EXTRACTION_FAILED` with the OCR
      explanation.

**Happy path (sample report, demo mode)**

- [ ] 37 biomarkers extracted; counts add up to the total.
- [ ] Patient reads *48 years (derived from date of birth) · Male*.
- [ ] Total Cholesterol 209 mg/dL → **Out of range**, reason cites `< 200 mg/dL`.
- [ ] Blood Group `A` and Rh Factor `Positivo` → **Needs review** (non-numeric).
- [ ] C-Reactive Protein `<0,2` → **Needs review**, and the value keeps its
      original `mg/L` unit.
- [ ] Hematíes shows the standardized name *Red Blood Cells (RBC)* with
      *Hematíes* underneath, and the unit as `10^6/µL`.
- [ ] Optimal count is `0` — correct for this report, which prints no
      unconditional optimal range.

**Interaction and accessibility**

- [ ] Drag-and-drop and the file picker both work.
- [ ] *Remove* clears the selection; the same file can be picked again.
- [ ] Search filters by standardized name, original name, panel and unit; the
      "Showing N of M" line updates and is announced.
- [ ] The status filter narrows the table; an empty result shows a friendly row.
- [ ] Clicking a biomarker name or the chevron opens the detail Sheet with the
      reason, ranges (applied one marked), confidence and source page.
- [ ] `Escape` closes the Sheet; focus returns sensibly.
- [ ] The whole flow is reachable with `Tab` and `Enter` only.
- [ ] Layout holds at 375 px, 768 px and 1440 px; the table scrolls horizontally
      inside its own container rather than the page.
- [ ] *Analyze another report* returns to the empty upload state.

**Privacy**

- [ ] The Network tab shows exactly one request to `/api/analyze`; no request
      goes from the browser to any AI provider.
- [ ] The server log contains no report content and no API key.

---

## Limitations and tradeoffs

- **No OCR.** Scanned and photographed reports are rejected with a clear message
  instead of being processed badly. The extension point is documented above.
- **Extraction quality is the model's.** A wrong transcription produces a wrong
  status, deterministically. The detail Sheet shows the model's confidence, the
  source page and everything as printed so a result can be checked against the
  original in seconds — but this is mitigation, not a guarantee.
- **Demo mode ignores the uploaded file's content.** By design, and stated
  loudly in the UI.
- **No molar unit conversions**, for the reason given above.
- **The name dictionary is finite.** It covers the sample report and common
  panels; anything else falls back to the model's translation or the original
  name, with the source shown.
- **No persistence, no accounts, no history, no export.** Out of scope for the
  brief, and each would change the privacy posture materially.
- **No automated test suite.** Also out of scope; the domain layer is pure and
  framework-free precisely so that unit tests would be trivial to add — `classify.ts`,
  `units.ts` and `biomarker-names.ts` have no I/O and no framework dependencies.
- **Single-request processing.** A very large report plus a slow provider can
  approach the platform's function timeout. See below.
- **English UI only**, although reports in any language are supported.

---

## Production architecture on AWS

Not deployed. This is how I would run it, optimising for low fixed cost and a
small PHI blast radius.

### Baseline (what the current shape needs)

```
Route 53 ─▶ CloudFront ─▶ S3            static assets, immutable, long TTL
                       └▶ API Gateway (HTTP API) ─▶ Lambda (Node 20, arm64)
                                                     ├─ pdfjs text extraction
                                                     ├─ AI provider call
                                                     └─ deterministic analysis
                                                         │
                                          Secrets Manager / SSM Parameter Store
                                                         │
                                                    CloudWatch (metrics + codes)
```

- **CloudFront + S3** for the static bundle. Pennies at this traffic, and it
  keeps the compute path free of asset requests.
- **API Gateway (HTTP API) + Lambda** for `/api/analyze`. The workload is bursty
  and stateless, so per-request billing beats an idle container. Graviton
  (`arm64`) is ~20% cheaper for the same work. Memory around 1024 MB: pdfjs is
  CPU-bound during parsing, and on Lambda more memory means more CPU, so a larger
  size is often *cheaper* per request than a smaller one.
- **Secrets Manager** for `AI_API_KEY` (rotation, audit trail), **SSM Parameter
  Store** for non-secret configuration (free tier, no per-secret charge). Cached
  in the execution context, never logged.
- **Limits everywhere**: API Gateway payload cap and throttling, Lambda timeout
  just above `AI_TIMEOUT_MS`, reserved concurrency to bound spend, WAF rate
  limiting in front of CloudFront.
- **CloudWatch without PHI.** Metrics on request counts, latency and the error
  code distribution. Structured logs that carry a request id and an error code
  and nothing else. A 14–30 day retention policy so even that ages out.

Rough monthly cost for a demo or an early pilot: a few dollars of AWS spend,
dominated entirely by AI provider tokens. Almost all of the fixed cost is
Route 53 and Secrets Manager.

### If the workload grows

- **Large files or long processing.** Once reports get big enough to risk the API
  Gateway payload limit or a 30-second client wait, switch to a presigned S3
  upload plus an async job: the browser PUTs directly to a temporary bucket,
  Lambda processes on the S3 event, and the client polls or receives a WebSocket
  push. The bucket gets SSE-KMS, Block Public Access, TLS-only bucket policy, and
  a **1-day lifecycle expiry** — the object exists only long enough to be read.
- **Very large reports.** Move extraction to a container (App Runner or ECS
  Fargate) where a 15-minute Lambda ceiling and 10 GB `/tmp` are not constraints.
- **OCR.** Textract as an async job on the temporary S3 object, feeding the same
  `{ pageNumber, text }` array.
- **Multiple providers.** Bedrock keeps inference inside the AWS account and
  under the same data agreement, which materially simplifies the PHI story
  compared with a third-party API. It slots in as one more `AiProvider`.

### If persistence is introduced

The moment results are saved, this stops being a stateless tool and becomes a
health record system. Supabase is a reasonable choice at that point — Postgres
with row-level security, built-in auth, and encrypted storage with signed URLs —
because RLS makes "a user can only ever read their own results" a database
guarantee rather than an application convention. That step needs a data
processing agreement, a documented retention policy, per-tenant encryption
decisions, audit logging, and a considered answer to whether raw PDFs are stored
at all or only the derived structured results. It is deliberately not part of
this challenge.

---

## Disclaimer

This tool is informational and is **not medical advice**. It classifies results
only against the ranges printed on the uploaded report and adds no thresholds,
targets or interpretations of its own. It is not a medical device. Always discuss
laboratory results with a qualified healthcare professional.
