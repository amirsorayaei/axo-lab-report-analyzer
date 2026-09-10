import { NextResponse } from "next/server";

import { getAiProvider } from "@/lib/ai/provider";
import { getServerConfig } from "@/lib/config";
import { analyzeExtraction } from "@/lib/domain/analyze";
import { AppError, toAppError } from "@/lib/domain/errors";
import { extractPdfText } from "@/lib/pdf/extract";
import { validateUpload } from "@/lib/pdf/validate";
import type { AnalyzeResponse } from "@/lib/api-types";

export const runtime = "nodejs";
/** The PDF must be read on every request; nothing about it is cacheable. */
export const dynamic = "force-dynamic";

/**
 * Upload -> validate -> extract text -> provider -> deterministic analysis.
 *
 * Nothing is persisted: the file bytes, the extracted text and the analysis all
 * live inside this request. No PHI is logged.
 */
export async function POST(request: Request): Promise<NextResponse<AnalyzeResponse>> {
  try {
    const config = getServerConfig();
    const formData = await readFormData(request);
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("INVALID_FILE_TYPE", "No PDF file was received.", {
        hint: 'The request must contain a "file" field.',
      });
    }

    const upload = await validateUpload(file, config.maxUploadBytes);
    const extraction = await extractPdfText(upload.bytes);

    const provider = getAiProvider();
    const raw = await provider.extract({
      pages: extraction.pages,
      signal: request.signal,
    });

    const result = analyzeExtraction(raw, {
      pageCount: extraction.pageCount,
      providerMode: provider.mode,
      providerLabel: provider.label,
    });

    return NextResponse.json<AnalyzeResponse>({ ok: true, data: result });
  } catch (error) {
    const appError = toAppError(error);

    // Only the error code is logged. Messages may quote report text, so they are
    // returned to the caller but never written to the server log.
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
