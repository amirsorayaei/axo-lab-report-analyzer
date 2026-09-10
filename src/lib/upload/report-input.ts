import type { PdfPage } from "@/lib/pdf/extract";

/**
 * The normalized, ordered representation of everything the user uploaded.
 *
 * `sourceIndex` is the 1-based position the user chose, and it is the only
 * ordering that matters downstream: the prompt labels blocks with it and the
 * model is told the sources are consecutive parts of one report.
 */
export type ReportInput =
  | {
      kind: "text";
      sourceIndex: number;
      fileName: string;
      pages: PdfPage[];
    }
  | {
      kind: "image";
      sourceIndex: number;
      fileName: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
      /** `data:<mime>;base64,...`. Never logged, never persisted. */
      dataUrl: string;
    };

export type ReportInputStats = {
  fileCount: number;
  pdfCount: number;
  imageCount: number;
  pdfPageCount: number;
  sourceTypes: Array<"text" | "image">;
  files: Array<{
    sourceIndex: number;
    fileName: string;
    kind: "text" | "image";
    /** Page count for PDFs, `null` for images. */
    pageCount: number | null;
  }>;
};

export function summarizeInputs(inputs: ReportInput[]): ReportInputStats {
  const pdfPageCount = inputs.reduce(
    (total, input) => total + (input.kind === "text" ? input.pages.length : 0),
    0,
  );

  return {
    fileCount: inputs.length,
    pdfCount: inputs.filter((input) => input.kind === "text").length,
    imageCount: inputs.filter((input) => input.kind === "image").length,
    pdfPageCount,
    sourceTypes: [...new Set(inputs.map((input) => input.kind))],
    files: inputs.map((input) => ({
      sourceIndex: input.sourceIndex,
      fileName: input.fileName,
      kind: input.kind,
      pageCount: input.kind === "text" ? input.pages.length : null,
    })),
  };
}

export function hasImageInput(inputs: ReportInput[]): boolean {
  return inputs.some((input) => input.kind === "image");
}
