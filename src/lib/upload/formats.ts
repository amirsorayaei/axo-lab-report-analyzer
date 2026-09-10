/**
 * Supported upload formats and limits.
 *
 * Shared by the client (for immediate feedback) and the server (which is the
 * only authority). Deliberately excluded: HEIC, SVG, GIF, DOCX. HEIC needs a
 * decoder most browsers do not have, SVG is an executable document format and a
 * genuine XSS/SSRF vector, and GIF and DOCX are not laboratory report formats.
 */

export const MAX_FILES = 8;
export const MAX_TOTAL_UPLOAD_BYTES = 30 * 1024 * 1024;

export type SupportedFormat = "pdf" | "jpeg" | "png" | "webp";

export type FormatDefinition = {
  format: SupportedFormat;
  label: string;
  /** Lowercase extensions accepted for this format. */
  extensions: string[];
  /** MIME types a browser may report. */
  mimeTypes: string[];
  kind: "pdf" | "image";
  /** Canonical MIME type used when the file is handed to the AI provider. */
  canonicalMimeType: string;
};

export const FORMATS: FormatDefinition[] = [
  {
    format: "pdf",
    label: "PDF",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf", "application/x-pdf"],
    kind: "pdf",
    canonicalMimeType: "application/pdf",
  },
  {
    format: "jpeg",
    label: "JPEG",
    extensions: [".jpg", ".jpeg"],
    mimeTypes: ["image/jpeg", "image/jpg"],
    kind: "image",
    canonicalMimeType: "image/jpeg",
  },
  {
    format: "png",
    label: "PNG",
    extensions: [".png"],
    mimeTypes: ["image/png"],
    kind: "image",
    canonicalMimeType: "image/png",
  },
  {
    format: "webp",
    label: "WebP",
    extensions: [".webp"],
    mimeTypes: ["image/webp"],
    kind: "image",
    canonicalMimeType: "image/webp",
  },
];

/** `accept` attribute for the file input. */
export const ACCEPT_ATTRIBUTE = FORMATS.flatMap((definition) => [
  ...definition.mimeTypes,
  ...definition.extensions,
]).join(",");

export const SUPPORTED_FORMAT_LABEL = "PDF, JPEG, PNG or WebP";

export function formatFromExtension(fileName: string): FormatDefinition | null {
  const lower = fileName.toLowerCase();
  return (
    FORMATS.find((definition) =>
      definition.extensions.some((extension) => lower.endsWith(extension)),
    ) ?? null
  );
}

/**
 * Identity used to reject duplicates. Name, size and type together, because two
 * genuinely different pages of one report can share a name or a size, but rarely
 * all three at once.
 */
export function fileIdentity(file: {
  name: string;
  size: number;
  type: string;
}): string {
  return `${file.name.toLowerCase()}::${file.size}::${file.type.toLowerCase()}`;
}
