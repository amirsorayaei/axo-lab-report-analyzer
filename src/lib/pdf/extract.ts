import "server-only";

import { AppError } from "@/lib/domain/errors";

/**
 * The `legacy` build targets plain Node without a DOM. Text is reconstructed
 * into visual rows because lab reports put the name, value, unit and range on
 * one row, and losing that grouping pairs values with the wrong range.
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

export async function extractPdfText(
  bytes: Uint8Array,
  fileName: string,
): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    // pdfjs transfers the buffer, so hand it a copy the caller does not reuse.
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    // Font warnings would write report-derived text into server logs.
    verbosity: 0,
  });

  let document;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    throw new AppError("PDF_CORRUPTED", `"${fileName}" could not be opened.`, {
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
        `No readable text could be extracted from "${fileName}".`,
        {
          hint: "This PDF looks like a scan or an image-only export. PDFs are read locally and are not sent to the AI provider, so a scanned PDF cannot be analysed. Export a text-based PDF from the laboratory portal, or upload a photograph or screenshot of the pages as JPEG, PNG or WebP instead.",
        },
      );
    }

    return { pages, pageCount: document.numPages, totalCharacters };
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Groups items into visual rows by y, orders each row left to right, and pads
 * wide horizontal gaps so column boundaries stay visible to the model.
 */
function reconstructLines(items: TextItemLike[]): string {
  /** Baseline drift tolerated between neighbouring items of one row. */
  const STEP_TOLERANCE = 2.5;
  /** Total baseline span one row may cover, roughly one text height. */
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

  // Labs print the value a couple of points above the name it belongs to, so
  // each item is compared against the previous one rather than the row start;
  // ROW_SPAN stops that chain swallowing the next row.
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
          // ~4pt per character at the font sizes lab reports use.
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
