import "server-only";

import {
  FORMATS,
  MAX_FILES,
  MAX_TOTAL_UPLOAD_BYTES,
  SUPPORTED_FORMAT_LABEL,
  fileIdentity,
  formatFromExtension,
  type FormatDefinition,
  type SupportedFormat,
} from "@/lib/upload/formats";
import { AppError } from "@/lib/domain/errors";

export type ValidatedUpload = {
  bytes: Uint8Array;
  fileName: string;
  sizeBytes: number;
  format: SupportedFormat;
  definition: FormatDefinition;
  /** 1-based position in the order the user selected. */
  sourceIndex: number;
};

// Authoritative: the extension and browser MIME type are client-controlled.
const SIGNATURES: Record<SupportedFormat, (bytes: Uint8Array) => boolean> = {
  pdf: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
  jpeg: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  png: (bytes) =>
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  // "RIFF" .... "WEBP"
  webp: (bytes) =>
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.byteLength >= 12 &&
    startsWith(bytes.subarray(8, 12), [0x57, 0x45, 0x42, 0x50]),
};

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.byteLength < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

/**
 * Any invalid file rejects the whole request: a partially analysed report would
 * silently omit results, which is worse than a clear failure.
 */
export async function validateUploads(
  files: File[],
  maxFileBytes: number,
): Promise<ValidatedUpload[]> {
  if (files.length === 0) {
    throw new AppError("NO_FILES", "No file was received.", {
      hint: "Select at least one report file.",
    });
  }

  if (files.length > MAX_FILES) {
    throw new AppError("TOO_MANY_FILES", "Too many files were selected.", {
      hint: `Up to ${MAX_FILES} files can be analysed as one report; ${files.length} were selected.`,
    });
  }

  const declaredTotal = files.reduce((total, file) => total + file.size, 0);
  if (declaredTotal > MAX_TOTAL_UPLOAD_BYTES) {
    throw new AppError("TOTAL_UPLOAD_TOO_LARGE", "The selected files are too large.", {
      hint: `The combined limit is ${megabytes(MAX_TOTAL_UPLOAD_BYTES)} MB and the selection is ${megabytes(declaredTotal, 1)} MB.`,
    });
  }

  const seen = new Set<string>();
  const validated: ValidatedUpload[] = [];
  let actualTotal = 0;

  for (const [index, file] of files.entries()) {
    const sourceIndex = index + 1;
    const identity = fileIdentity(file);

    if (seen.has(identity)) {
      throw new AppError("DUPLICATE_FILE", "The same file was selected twice.", {
        hint: `"${file.name}" appears more than once. Remove the duplicate and try again.`,
      });
    }
    seen.add(identity);

    validated.push(await validateOne(file, sourceIndex, maxFileBytes));
    actualTotal += validated[validated.length - 1].sizeBytes;

    // Against real byte lengths, not the size the browser claimed.
    if (actualTotal > MAX_TOTAL_UPLOAD_BYTES) {
      throw new AppError("TOTAL_UPLOAD_TOO_LARGE", "The selected files are too large.", {
        hint: `The combined limit is ${megabytes(MAX_TOTAL_UPLOAD_BYTES)} MB.`,
      });
    }
  }

  return validated;
}

async function validateOne(
  file: File,
  sourceIndex: number,
  maxFileBytes: number,
): Promise<ValidatedUpload> {
  const fileName = file.name || `file-${sourceIndex}`;
  const where = `"${fileName}" (file ${sourceIndex})`;

  const definition = formatFromExtension(fileName);
  if (!definition) {
    throw new AppError("INVALID_FILE_TYPE", `${where} is not a supported format.`, {
      hint: `Supported formats are ${SUPPORTED_FORMAT_LABEL}.`,
    });
  }

  // Empty is normal for drag-and-drop, so reject only a contradicting type.
  if (file.type !== "" && !definition.mimeTypes.includes(file.type.toLowerCase())) {
    throw new AppError("INVALID_FILE_TYPE", `${where} is not a supported format.`, {
      hint: `The browser reported the type "${file.type}", which does not match a ${definition.label} file.`,
    });
  }

  if (file.size === 0) {
    throw new AppError("EMPTY_FILE", `${where} is empty.`);
  }

  if (file.size > maxFileBytes) {
    throw new AppError("FILE_TOO_LARGE", `${where} is too large.`, {
      hint: `The per-file limit is ${megabytes(maxFileBytes)} MB and this file is ${megabytes(file.size, 1)} MB.`,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new AppError("EMPTY_FILE", `${where} is empty.`);
  }

  if (bytes.byteLength > maxFileBytes) {
    throw new AppError("FILE_TOO_LARGE", `${where} is too large.`);
  }

  if (!SIGNATURES[definition.format](bytes)) {
    // Distinguished so the UI can explain the two cases differently.
    const code =
      definition.kind === "pdf" ? "INVALID_PDF_SIGNATURE" : "INVALID_IMAGE_SIGNATURE";
    throw new AppError(code, `${where} is not a valid ${definition.label} file.`, {
      hint: "The file contents do not match its extension. It may have been renamed or is damaged.",
    });
  }

  return {
    bytes,
    fileName,
    sizeBytes: bytes.byteLength,
    format: definition.format,
    definition,
    sourceIndex,
  };
}

function megabytes(bytes: number, digits = 0): string {
  return (bytes / (1024 * 1024)).toFixed(digits);
}

export { FORMATS };
