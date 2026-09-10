import "server-only";

import sharp from "sharp";

import { AppError } from "@/lib/domain/errors";

/**
 * Prepares a photographed or scanned report page for a vision model.
 *
 * Four things happen here, in this order and for these reasons:
 *
 * 1. `rotate()` with no argument applies the EXIF orientation tag and then drops
 *    it. Phone photos are almost always stored sideways with an orientation
 *    flag, and a model reading a sideways table produces nonsense.
 * 2. Re-encoding through sharp strips every metadata block — EXIF, GPS, XMP,
 *    ICC, thumbnails. A photo of a lab report taken on a phone routinely carries
 *    the patient's home coordinates; none of that should reach a third party.
 * 3. Downscaling happens only when a side exceeds the limit, and never upscales.
 *    Readability of small print is the whole point, so the cap is generous.
 * 4. The result is encoded as a data URL for the multimodal message.
 *
 * The bytes and the resulting data URL are never logged and never written to
 * disk; everything stays in memory for the lifetime of the request.
 */

/** Large enough to keep small print legible, small enough to bound token cost. */
const MAX_DIMENSION = 2400;

export type NormalizedImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
  width: number;
  height: number;
  byteLength: number;
};

export async function normalizeImage(
  bytes: Uint8Array,
  fileName: string,
): Promise<NormalizedImage> {
  try {
    const pipeline = sharp(Buffer.from(bytes), { failOn: "error" });
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new AppError("IMAGE_CORRUPTED", `"${fileName}" could not be read as an image.`);
    }

    // PNG is kept lossless because screenshots of portals are frequently PNG and
    // JPEG artefacts around thin glyphs hurt small-print legibility. Everything
    // else becomes high-quality JPEG, which is far cheaper per token.
    const keepPng = metadata.format === "png";

    const output = sharp(Buffer.from(bytes), { failOn: "error" })
      // No argument: apply the EXIF orientation tag, then discard it.
      .rotate()
      // Both axes are capped and `withoutEnlargement` makes this a no-op for
      // images already within the cap. Constraining both matters because
      // `rotate()` swaps width and height for sideways phone photos, so the
      // pre-rotation dimensions cannot be used to pick an axis.
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });

    // No `.withMetadata()` call anywhere: sharp drops all metadata by default.
    const encoded = keepPng
      ? await output.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await output
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

    const mimeType = keepPng ? "image/png" : "image/jpeg";

    return {
      mimeType,
      dataUrl: `data:${mimeType};base64,${encoded.data.toString("base64")}`,
      width: encoded.info.width,
      height: encoded.info.height,
      byteLength: encoded.data.byteLength,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    // The underlying decoder message can quote file internals, so it is used as
    // a cause for the stack only and never surfaced to the client.
    throw new AppError("IMAGE_CORRUPTED", `"${fileName}" could not be read as an image.`, {
      hint: "The file may be damaged or use an unsupported variant of its format.",
      cause: error,
    });
  }
}
