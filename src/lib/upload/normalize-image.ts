import "server-only";

import sharp from "sharp";

import { AppError } from "@/lib/domain/errors";

/**
 * Prepares a photographed report page for a vision model: applies and drops the
 * EXIF orientation, strips all metadata (a phone photo routinely carries the
 * patient's GPS coordinates, which must not reach a third party), bounds both
 * sides without upscaling, and encodes a data URL.
 *
 * Bytes and the data URL stay in memory for the request — never logged, never
 * written to disk.
 */

/** Large enough for small print, small enough to bound token cost. */
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

    // Portal screenshots are usually PNG, and JPEG artefacts around thin glyphs
    // hurt small-print legibility. Everything else is cheaper as JPEG.
    const keepPng = metadata.format === "png";

    const output = sharp(Buffer.from(bytes), { failOn: "error" })
      .rotate()
      // Both axes are capped because `rotate()` swaps width and height, so the
      // pre-rotation dimensions cannot be used to pick one.
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });

    // Never call `.withMetadata()`: sharp drops EXIF/GPS by default.
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
    // Decoder messages can quote file internals, so keep them off the client.
    throw new AppError("IMAGE_CORRUPTED", `"${fileName}" could not be read as an image.`, {
      hint: "The file may be damaged or use an unsupported variant of its format.",
      cause: error,
    });
  }
}
