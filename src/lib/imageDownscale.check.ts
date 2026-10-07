/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for the JPEG header scan and the scaling maths. The decode itself
 * needs a browser, so only the pure parts are covered. Run:
 * node --experimental-strip-types src/lib/imageDownscale.check.ts
 */

import assert from 'node:assert';
import {
  displayedSizeForOrientation,
  fitWithin,
  readJpegMetadata,
  readJpegSize,
} from './imageDownscale.ts';

/** Builds a minimal JPEG: SOI, the given segments, then a SOF0 of w x h. */
const jpeg = (segments: number[][], width: number, height: number): Uint8Array =>
  Uint8Array.from([
    0xff, 0xd8,
    ...segments.flat(),
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
  ]);

/** A segment with a 2-byte length header, as everything but SOI/EOI/RSTn has. */
const segment = (marker: number, payloadBytes: number): number[] => [
  0xff, marker,
  ((payloadBytes + 2) >> 8) & 0xff, (payloadBytes + 2) & 0xff,
  ...new Array(payloadBytes).fill(0),
];

/** Minimal APP1 Exif segment containing one IFD0 orientation entry. */
const exifOrientationSegment = (
  orientation: number,
  byteOrder: 'little' | 'big',
): number[] => {
  const littleEndian = byteOrder === 'little';
  const uint16 = (value: number): number[] =>
    littleEndian ? [value & 0xff, (value >> 8) & 0xff] : [(value >> 8) & 0xff, value & 0xff];
  const uint32 = (value: number): number[] =>
    littleEndian
      ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
      : [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    ...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...uint16(42),
    ...uint32(8), // IFD0 begins immediately after the TIFF header.
    ...uint16(1), // One IFD entry.
    ...uint16(0x0112),
    ...uint16(3), // SHORT
    ...uint32(1),
    ...uint16(orientation),
    0x00, 0x00,
    ...uint32(0), // No next IFD.
  ];
  return [
    0xff, 0xe1,
    ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff,
    ...payload,
  ];
};

// Plain SOF0 straight after SOI. Note width and height are stored height-first.
assert.deepStrictEqual(readJpegSize(jpeg([], 4032, 3024)), { width: 4032, height: 3024 });
assert.deepStrictEqual(readJpegMetadata(jpeg([], 4032, 3024)), {
  width: 4032,
  height: 3024,
  orientation: 1,
});

// Real camera files put EXIF (APP1) and often a JFIF block (APP0) first — the
// scan has to walk past them using their length fields.
assert.deepStrictEqual(
  readJpegSize(jpeg([segment(0xe0, 14), segment(0xe1, 4000)], 3000, 4000)),
  { width: 3000, height: 4000 },
);

// Android and iPhone camera JPEGs commonly store landscape pixels with a
// rotation tag. Both TIFF byte orders must parse without decoding the image.
assert.deepStrictEqual(
  readJpegMetadata(jpeg([exifOrientationSegment(6, 'little')], 4032, 3024)),
  { width: 4032, height: 3024, orientation: 6 },
);
assert.deepStrictEqual(
  readJpegMetadata(jpeg([segment(0xe0, 14), exifOrientationSegment(8, 'big')], 4032, 3024)),
  { width: 4032, height: 3024, orientation: 8 },
);

// Invalid Exif is metadata, not a reason to reject an otherwise valid receipt.
// Unknown orientation values safely behave like the normal orientation.
assert.deepStrictEqual(
  readJpegMetadata(jpeg([exifOrientationSegment(9, 'little')], 1200, 900)),
  { width: 1200, height: 900, orientation: 1 },
);
{
  const corruptOffset = exifOrientationSegment(6, 'little');
  // APP1 marker + length + "Exif\0\0" + TIFF byte order/magic = 14 bytes;
  // replace the four-byte IFD offset with a value beyond the segment.
  corruptOffset.splice(14, 4, 0xff, 0xff, 0xff, 0x7f);
  assert.deepStrictEqual(readJpegMetadata(jpeg([corruptOffset], 1200, 900)), {
    width: 1200,
    height: 900,
    orientation: 1,
  });
}

// Runs of 0xFF are legal padding between segments.
assert.deepStrictEqual(
  readJpegSize(jpeg([segment(0xe1, 20), [0xff, 0xff, 0xff]], 1600, 1200)),
  { width: 1600, height: 1200 },
);

// 0xC4 is a Huffman table, not a frame header, despite sitting in the SOF range.
// Misreading it would yield garbage dimensions instead of walking on to SOF0.
assert.deepStrictEqual(
  readJpegSize(jpeg([segment(0xc4, 30)], 800, 600)),
  { width: 800, height: 600 },
);

// Progressive JPEG (SOF2) is still a frame header.
{
  const bytes = jpeg([], 1024, 768);
  bytes[2 + 1] = 0xc2;
  assert.deepStrictEqual(readJpegSize(bytes), { width: 1024, height: 768 });
}

// Non-JPEG and truncated input must return null so the caller falls back
// instead of feeding createImageBitmap a bogus target size.
assert.strictEqual(readJpegSize(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), null); // PNG
assert.strictEqual(readJpegSize(Uint8Array.from([0xff, 0xd8])), null);
assert.strictEqual(readJpegSize(new Uint8Array(0)), null);
// Header cut off mid-EXIF: no SOF found, so no size.
assert.strictEqual(readJpegSize(Uint8Array.from([0xff, 0xd8, ...segment(0xe1, 40)])), null);

// Scaling: longest side capped, aspect preserved, small images left alone.
assert.deepStrictEqual(fitWithin({ width: 4032, height: 3024 }, 1020), { width: 1020, height: 765 });
assert.deepStrictEqual(fitWithin({ width: 3024, height: 4032 }, 1020), { width: 765, height: 1020 });
assert.deepStrictEqual(fitWithin({ width: 800, height: 600 }, 1020), { width: 800, height: 600 });
assert.deepStrictEqual(fitWithin({ width: 1020, height: 1020 }, 1020), { width: 1020, height: 1020 });
// Never rounds a sliver of an image down to a zero-sized canvas.
assert.deepStrictEqual(fitWithin({ width: 8000, height: 3 }, 1020), { width: 1020, height: 1 });

// Orientations 5-8 transpose the axes. The displayed portrait target must be
// 765x1020, never the old stretched 1020x765 landscape rectangle.
for (const orientation of [1, 2, 3, 4] as const) {
  assert.deepStrictEqual(
    displayedSizeForOrientation({ width: 4032, height: 3024 }, orientation),
    { width: 4032, height: 3024 },
  );
}
for (const orientation of [5, 6, 7, 8] as const) {
  const displayed = displayedSizeForOrientation({ width: 4032, height: 3024 }, orientation);
  assert.deepStrictEqual(displayed, { width: 3024, height: 4032 });
  assert.deepStrictEqual(fitWithin(displayed, 1020), { width: 765, height: 1020 });
}

// The whole point: a 50 MP capture is decoded at ~0.8 MP, so peak pixels drop
// by ~64x versus decoding at native resolution and scaling afterwards.
{
  const source = { width: 8160, height: 6120 };
  const target = fitWithin(source, 1020);
  const ratio = (source.width * source.height) / (target.width * target.height);
  assert.ok(ratio > 60, `expected a large reduction, got ${ratio.toFixed(1)}x`);
}

console.log('imageDownscale.check.ts OK');
