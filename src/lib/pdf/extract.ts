import "server-only";

import { AppError } from "@/lib/domain/errors";

/**
 * Server-side PDF text extraction with pdfjs-dist.
 *
 * The `legacy` build is used because it targets plain Node without a DOM. Text
 * is reconstructed line by line so column layout survives: laboratory reports
 * put the biomarker name, the value, the unit and the range on one visual row,
 * and losing that grouping makes the text unusable for extraction.
 */

export type PdfPage = {
  /** 1-based, matching what the report itself prints. */
  pageNumber: number;
  text: string;
};

export type PdfExtraction = {
  pages: PdfPage[];
  pageCount: number;
  totalCharacters: number;
};

/** Below this, a PDF is treated as scanned rather than text-bearing. */
const MIN_USABLE_CHARACTERS = 200;

type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
};

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    // pdfjs transfers the buffer, so hand it a copy the caller does not reuse.
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    // Font substitution warnings are irrelevant for text extraction and would
    // otherwise write report-derived noise into server logs.
    verbosity: 0,
  });

  let document;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    throw new AppError("PDF_CORRUPTED", "This PDF could not be opened.", {
      hint: "The file may be damaged, encrypted or password protected.",
      cause: error,
    });
  }

  try {
    const pages: PdfPage[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({
        pageNumber,
        text: reconstructLines(content.items as TextItemLike[]),
      });
      page.cleanup();
    }

    const totalCharacters = pages.reduce(
      (sum, page) => sum + page.text.replace(/\s/g, "").length,
      0,
    );

    if (totalCharacters < MIN_USABLE_CHARACTERS) {
      throw new AppError(
        "PDF_TEXT_EXTRACTION_FAILED",
        "No readable text could be extracted from this PDF.",
        {
          hint: "The report looks like a scan or an image-only export. Optical character recognition is not enabled in this version — please upload a text-based PDF exported from the laboratory portal.",
        },
      );
    }

    return { pages, pageCount: document.numPages, totalCharacters };
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Groups text items into visual rows by their y coordinate, then orders each row
 * left to right. A horizontal gap wider than a space becomes padded whitespace so
 * that column boundaries remain visible to the model.
 */
function reconstructLines(items: TextItemLike[]): string {
  /** Baseline drift tolerated between two neighbouring items of one row. */
  const STEP_TOLERANCE = 2.5;
  /** Total baseline span a single row may cover, roughly one text height. */
  const ROW_SPAN = 6.5;

  const positioned = items
    .filter((item) => typeof item.str === "string" && item.str.trim() !== "")
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  if (positioned.length === 0) return "";

  type Row = { top: number; last: number; items: typeof positioned };
  const rows: Row[] = [];

  // Laboratory reports print the value, the unit and the range a couple of
  // points above the biomarker name they belong to. Grouping against the
  // previous item (rather than the first item of the row) follows that drift,
  // while ROW_SPAN stops the chain from swallowing the next row.
  for (const item of positioned) {
    const row = rows.at(-1);
    const sameRow =
      row !== undefined &&
      Math.abs(row.last - item.y) <= STEP_TOLERANCE &&
      Math.abs(row.top - item.y) <= ROW_SPAN;

    if (row && sameRow) {
      row.items.push(item);
      row.last = item.y;
    } else {
      rows.push({ top: item.y, last: item.y, items: [item] });
    }
  }

  return rows
    .map((row) => {
      const ordered = row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let cursorX = ordered[0].x;

      for (const item of ordered) {
        const gap = item.x - cursorX;
        if (line !== "" && gap > 1) {
          // ~4pt per character at the font sizes used by lab reports.
          line += " ".repeat(Math.min(Math.max(Math.round(gap / 4), 1), 12));
        }
        line += item.text;
        cursorX = item.x + item.width;
      }

      return line.trimEnd();
    })
    .filter((line) => line.trim() !== "")
    .join("\n");
}
