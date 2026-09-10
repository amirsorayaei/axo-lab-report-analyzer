import "server-only";

import { AppError } from "@/lib/domain/errors";

/** Bytes of `%PDF-`, checked so a renamed file cannot pass as a PDF. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  // Some browsers send an empty type for drag-and-dropped files.
  "",
]);

export type ValidatedUpload = {
  bytes: Uint8Array;
  fileName: string;
  sizeBytes: number;
};

/**
 * Four independent checks, cheapest first: extension, MIME type, size, then the
 * file signature. The signature check is the one that actually matters — the
 * first three are client-supplied and therefore untrusted.
 */
export async function validateUpload(
  file: File,
  maxUploadBytes: number,
): Promise<ValidatedUpload> {
  const fileName = file.name ?? "upload.pdf";

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new AppError("INVALID_FILE_TYPE", "Only PDF files are supported.", {
      hint: "The selected file does not have a .pdf extension.",
    });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError("INVALID_FILE_TYPE", "Only PDF files are supported.", {
      hint: `The browser reported the type "${file.type}".`,
    });
  }

  if (file.size === 0) {
    throw new AppError("EMPTY_FILE", "The selected file is empty.");
  }

  if (file.size > maxUploadBytes) {
    throw new AppError("FILE_TOO_LARGE", "The selected file is too large.", {
      hint: `The limit is ${(maxUploadBytes / (1024 * 1024)).toFixed(0)} MB and this file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes.byteLength > maxUploadBytes) {
    throw new AppError("FILE_TOO_LARGE", "The selected file is too large.");
  }

  if (!hasPdfSignature(bytes)) {
    throw new AppError("INVALID_PDF_SIGNATURE", "This file is not a valid PDF.", {
      hint: "The file does not start with the %PDF- header.",
    });
  }

  return { bytes, fileName, sizeBytes: bytes.byteLength };
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_SIGNATURE.length) return false;
  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}
