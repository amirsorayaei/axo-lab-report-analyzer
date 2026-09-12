/**
 * Shared by the client for fast feedback; the server is the only authority.
 * SVG is excluded because it is an executable document format and an XSS/SSRF
 * vector; HEIC needs a decoder most browsers lack.
 */

export const MAX_FILES = 8;
export const MAX_TOTAL_UPLOAD_BYTES = 30 * 1024 * 1024;

export type SupportedFormat = "pdf" | "jpeg" | "png" | "webp";

export type FormatDefinition = {
  format: SupportedFormat;
  label: string;
  extensions: string[];
  /** Types a browser may report; not authoritative. */
  mimeTypes: string[];
  kind: "pdf" | "image";
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
 * Duplicate identity. All three fields together, because two different pages of
 * one report can share a name or a size, but rarely all three.
 */
export function fileIdentity(file: {
  name: string;
  size: number;
  type: string;
}): string {
  return `${file.name.toLowerCase()}::${file.size}::${file.type.toLowerCase()}`;
}
