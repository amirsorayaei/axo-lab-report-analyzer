import { NextResponse } from "next/server";

import { getAiProvider } from "@/lib/ai/provider";
import { getServerConfig } from "@/lib/config";
import { analyzeExtraction } from "@/lib/domain/analyze";
import { AppError, toAppError } from "@/lib/domain/errors";
import { extractPdfText } from "@/lib/pdf/extract";
import { normalizeImage } from "@/lib/upload/normalize-image";
import {
  hasImageInput,
  summarizeInputs,
  type ReportInput,
} from "@/lib/upload/report-input";
import { validateUploads, type ValidatedUpload } from "@/lib/upload/validate";
import type { AnalyzeResponse } from "@/lib/api-types";

// pdfjs and sharp need real Node APIs and native binaries.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nothing is persisted: file bytes, extracted text, image data URLs, the prompt
 * and the analysis all live inside this request. No PHI is ever logged.
 */
export async function POST(request: Request): Promise<NextResponse<AnalyzeResponse>> {
  try {
    const config = getServerConfig();
    const formData = await readFormData(request);

    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      throw new AppError("NO_FILES", "No report file was received.", {
        hint: 'The request must contain at least one "files" field.',
      });
    }

    const uploads = await validateUploads(files, config.maxUploadBytes);
    const inputs = await buildReportInputs(uploads);

    const provider = getAiProvider();

    if (hasImageInput(inputs) && !provider.supportsImages) {
      throw new AppError(
        "PROVIDER_NO_IMAGE_SUPPORT",
        "The configured AI provider cannot read image files.",
        {
          hint: "Upload text-based PDFs instead, or configure a model with image input support.",
        },
      );
    }

    const raw = await provider.extract({ inputs, signal: request.signal });

    if (raw.patient.conflictingSources) {
      throw new AppError(
        "CONFLICTING_PATIENTS",
        "The uploaded files appear to belong to different patients.",
        {
          hint: "All files in one analysis must be parts of a single report for a single patient. Remove the unrelated files and try again.",
        },
      );
    }

    if (raw.biomarkers.length === 0) {
      throw new AppError(
        "NO_LAB_DATA_FOUND",
        "No laboratory results could be read from the uploaded files.",
        {
          hint: "Check that every file is a page of a laboratory report and that photographs are sharp, upright and well lit.",
        },
      );
    }

    const result = analyzeExtraction(raw, {
      sources: summarizeInputs(inputs),
      providerMode: provider.mode,
      providerLabel: provider.label,
    });

    return NextResponse.json<AnalyzeResponse>({ ok: true, data: result });
  } catch (error) {
    const appError = toAppError(error);

    // Code only: messages may quote report text or file names.
    if (appError.code === "INTERNAL_ERROR") {
      console.error(`[analyze] unhandled failure (${appError.code})`);
    }

    return NextResponse.json<AnalyzeResponse>(
      {
        ok: false,
        error: {
          code: appError.code,
          message: appError.message,
          ...(appError.hint ? { hint: appError.hint } : {}),
        },
      },
      { status: appError.status },
    );
  }
}

/**
 * PDFs are read locally and the file itself never reaches the provider; images
 * have no text layer, so they are normalized and sent as vision input.
 */
async function buildReportInputs(uploads: ValidatedUpload[]): Promise<ReportInput[]> {
  const inputs: ReportInput[] = [];

  for (const upload of uploads) {
    if (upload.definition.kind === "pdf") {
      const extraction = await extractPdfText(upload.bytes, upload.fileName);
      inputs.push({
        kind: "text",
        sourceIndex: upload.sourceIndex,
        fileName: upload.fileName,
        pages: extraction.pages,
      });
      continue;
    }

    const image = await normalizeImage(upload.bytes, upload.fileName);
    inputs.push({
      kind: "image",
      sourceIndex: upload.sourceIndex,
      fileName: upload.fileName,
      mimeType: image.mimeType,
      dataUrl: image.dataUrl,
    });
  }

  return inputs;
}

async function readFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch (error) {
    throw new AppError("INVALID_FILE_TYPE", "The upload could not be read.", {
      hint: "The request body was not a valid multipart form upload.",
      cause: error,
    });
  }
}
