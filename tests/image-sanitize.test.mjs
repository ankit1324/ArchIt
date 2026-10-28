import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { sanitizeImage } from "../lib/image-sanitize.ts";
import { detectImageType } from "../lib/upload.ts";

// A small solid image; 40×20 so a 90° rotation is visible in the dimensions.
const base = () =>
  sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 120, b: 60 } } });

const EXIF = {
  IFD0: { Make: "TestCam", Model: "Serial-12345", Copyright: "owner" },
  IFD3: { GPSLatitudeRef: "N", GPSLatitude: "28/1 36/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "77/1 12/1 0/1" },
};

test("strips EXIF and GPS from a JPEG", async () => {
  const input = await base().jpeg().withExif(EXIF).toBuffer();
  const before = await sharp(input).metadata();
  assert.ok(before.exif, "fixture must carry EXIF");
  assert.ok(input.includes(Buffer.from("Serial-12345")), "fixture must carry the device serial");

  const out = await sanitizeImage(input, "image/jpeg");
  const after = await sharp(out).metadata();
  assert.equal(after.exif, undefined);
  assert.equal(after.xmp, undefined);
  assert.equal(after.iptc, undefined);
  assert.ok(!out.includes(Buffer.from("Serial-12345")));
  assert.ok(!out.includes(Buffer.from("TestCam")));
});

test("applies EXIF orientation before stripping", async () => {
  const input = await base().jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const before = await sharp(input).metadata();
  assert.equal(before.orientation, 6);
  assert.deepEqual([before.width, before.height], [40, 20]);

  const after = await sharp(await sanitizeImage(input, "image/jpeg")).metadata();
  assert.deepEqual([after.width, after.height], [20, 40]);
  assert.equal(after.orientation, undefined);
});

for (const [mime, encode] of [
  ["image/jpeg", (s) => s.jpeg()],
  ["image/png", (s) => s.png()],
  ["image/webp", (s) => s.webp()],
  ["image/avif", (s) => s.avif()],
]) {
  test(`keeps the format (${mime})`, async () => {
    const input = await encode(base()).withExif(EXIF).toBuffer();
    assert.equal(detectImageType(input), mime, "fixture must be accepted by the upload route");
    const out = await sanitizeImage(input, mime);
    assert.equal(detectImageType(out), mime);
    const meta = await sharp(out).metadata();
    assert.deepEqual([meta.width, meta.height], [40, 20]);
    assert.equal(meta.exif, undefined);
  });
}

test("refuses an unsupported mime", async () => {
  const input = await base().jpeg().toBuffer();
  await assert.rejects(sanitizeImage(input, "image/gif"), /unsupported/);
});
