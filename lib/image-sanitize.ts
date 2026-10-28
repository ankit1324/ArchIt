// Not lib/sharp.ts: that module imports "server-only", which node --test
// cannot load. Same re-typing trick (see types/sharp.d.ts).
import sharpUntyped from "sharp";
import type SharpTypes from "../node_modules/sharp/lib/index";
import { MAX_INPUT_PIXELS } from "./upload.ts";

const sharp = sharpUntyped as typeof SharpTypes;

/**
 * Re-encode an uploaded photo so the stored original carries no metadata.
 * Phone photos embed GPS coordinates, device serials and capture times in
 * EXIF/XMP; the photos bucket is public, so storing the upload as-is
 * published all of that. sharp drops every metadata block unless
 * withMetadata/withExif/keepMetadata is asked for, so a plain re-encode is the
 * strip. Orientation is applied to the pixels first (`.rotate()`), otherwise
 * dropping the tag would show portrait photos sideways.
 *
 * The format is kept (the stored name's extension and Content-Type come from
 * `mime`), at high quality: this is the full-size image the detail view
 * shows, and the resized thumbnails are where bytes are saved.
 * Rejects on an unsupported `mime` or an undecodable / over-budget image.
 */
export async function sanitizeImage(buf: Buffer, mime: string): Promise<Buffer> {
  // Animated WebP/AVIF must keep every frame; rotating a multi-page image is
  // not supported, and animations carry no EXIF orientation to apply anyway.
  const { pages = 1 } = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  const animated = pages > 1;
  let img = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, animated });
  if (!animated) img = img.rotate();
  switch (mime) {
    case "image/jpeg":
      return img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    case "image/png":
      // lossless either way; level 9 keeps the re-encode from bloating the file
      return img.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return img.webp({ quality: 90 }).toBuffer();
    case "image/avif":
      // AVIF's quality scale runs lower than JPEG's; 70 is visually lossless
      return img.avif({ quality: 70 }).toBuffer();
    default:
      throw new Error(`unsupported image type: ${mime}`);
  }
}
