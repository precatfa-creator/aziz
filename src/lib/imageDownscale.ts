/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Turning a camera photo into a receipt-sized JPEG without ever holding the
 * full-resolution bitmap.
 *
 * `new Image()` + drawImage decodes at native resolution first: a 50 MP phone
 * camera is 200 MB of RGBA before anything is scaled. On an installed Android
 * PWA — with the camera app also in the foreground — that reliably pushes the
 * WebView past its budget and Android reloads the page, losing the half-entered
 * transaction.
 *
 * createImageBitmap accepts the target size up front, so the browser subsamples
 * during decode and peak memory tracks the *output* size instead. It needs the
 * source dimensions to preserve the aspect ratio, which is why the JPEG header
 * is parsed first — that reads a few hundred bytes rather than decoding.
 */

export interface ImageSize {
  width: number;
  height: number;
}

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface JpegMetadata extends ImageSize {
  orientation: ExifOrientation;
}

const isExifOrientation = (value: number): value is ExifOrientation =>
  Number.isInteger(value) && value >= 1 && value <= 8;

/**
 * Reads the orientation tag from an APP1 Exif payload.
 *
 * Every offset in TIFF metadata is attacker-controlled, so all reads stay
 * inside this one JPEG segment. Invalid/truncated metadata is ignored and the
 * caller uses the normal, unrotated orientation.
 */
const readExifOrientation = (
  bytes: Uint8Array,
  payloadStart: number,
  payloadEnd: number,
): ExifOrientation | null => {
  // "Exif\0\0", an 8-byte TIFF header, then at least the IFD entry count.
  if (payloadEnd - payloadStart < 16) return null;
  if (
    bytes[payloadStart] !== 0x45 ||
    bytes[payloadStart + 1] !== 0x78 ||
    bytes[payloadStart + 2] !== 0x69 ||
    bytes[payloadStart + 3] !== 0x66 ||
    bytes[payloadStart + 4] !== 0x00 ||
    bytes[payloadStart + 5] !== 0x00
  ) {
    return null;
  }

  const tiffStart = payloadStart + 6;
  const littleEndian =
    bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49
      ? true
      : bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d
        ? false
        : null;
  if (littleEndian === null) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readUint16 = (offset: number): number | null =>
    offset >= tiffStart && offset + 2 <= payloadEnd
      ? view.getUint16(offset, littleEndian)
      : null;
  const readUint32 = (offset: number): number | null =>
    offset >= tiffStart && offset + 4 <= payloadEnd
      ? view.getUint32(offset, littleEndian)
      : null;

  if (readUint16(tiffStart + 2) !== 42) return null;
  const ifdOffset = readUint32(tiffStart + 4);
  if (ifdOffset === null) return null;
  const ifdStart = tiffStart + ifdOffset;
  const entryCount = readUint16(ifdStart);
  if (entryCount === null) return null;

  // Stop at the segment boundary even if a corrupt entry count claims more.
  const availableEntries = Math.floor((payloadEnd - (ifdStart + 2)) / 12);
  const safeEntryCount = Math.min(entryCount, availableEntries);
  for (let index = 0; index < safeEntryCount; index++) {
    const entryStart = ifdStart + 2 + index * 12;
    if (readUint16(entryStart) !== 0x0112) continue;

    // Orientation is one SHORT stored inline in the four-byte value field.
    if (readUint16(entryStart + 2) !== 3 || readUint32(entryStart + 4) !== 1) {
      return null;
    }
    const orientation = readUint16(entryStart + 8);
    return orientation !== null && isExifOrientation(orientation) ? orientation : null;
  }

  return null;
};

/**
 * Reads frame size and display orientation without decoding the JPEG pixels.
 *
 * Camera captures are normally JPEG; anything else (PNG, WebP, HEIC) returns
 * null and the caller falls back to a plain decode. Width and height are the raw
 * SOF dimensions; `orientation` tells the caller how the decoder will display
 * them after applying Exif metadata.
 */
export const readJpegMetadata = (bytes: Uint8Array): JpegMetadata | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  let orientation: ExifOrientation = 1;
  let frameSize: ImageSize | null = null;

  while (offset + 1 < bytes.length) {
    // Segments are 0xFF followed by a marker; padding runs of 0xFF are legal.
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) break;

    const marker = bytes[offset++];
    if (marker === 0x00) {
      // Byte stuffing only belongs to scan data; tolerate it in a malformed
      // header rather than treating the following bytes as a segment length.
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      // EOI/SOS: metadata segments cannot occur after compressed scan data.
      break;
    }
    // Standalone markers: no length field, nothing to skip.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }
    if (offset + 2 > bytes.length) break;

    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2) return null;
    const payloadStart = offset + 2;
    const segmentEnd = offset + length;
    if (segmentEnd > bytes.length) {
      // A bounded header slice can legitimately end mid-segment. Preserve a
      // frame already found; otherwise let the caller use its safe fallback.
      break;
    }

    if (marker === 0xe1) {
      orientation = readExifOrientation(bytes, payloadStart, segmentEnd) ?? orientation;
    }

    // SOF0/1/2/3, 5/6/7, 9/10/11, 13/14/15 all carry the frame size. 0xC4
    // (Huffman tables), 0xC8 and 0xCC are not frame headers despite the range.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (length < 9) return null;
      const height = (bytes[payloadStart + 1] << 8) | bytes[payloadStart + 2];
      const width = (bytes[payloadStart + 3] << 8) | bytes[payloadStart + 4];
      if (width <= 0 || height <= 0) return null;
      frameSize = { width, height };
    }

    offset = segmentEnd;
  }

  return frameSize ? { ...frameSize, orientation } : null;
};

/** Backwards-compatible frame-size helper used by existing checks/callers. */
export const readJpegSize = (bytes: Uint8Array): ImageSize | null => {
  const metadata = readJpegMetadata(bytes);
  return metadata ? { width: metadata.width, height: metadata.height } : null;
};

/** Dimensions after the browser applies the JPEG's Exif orientation. */
export const displayedSizeForOrientation = (
  size: ImageSize,
  orientation: ExifOrientation,
): ImageSize =>
  orientation >= 5
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };

/** Longest side capped at maxDim; images already smaller are left alone. */
export const fitWithin = (size: ImageSize, maxDim: number): ImageSize => {
  const scale = Math.min(1, maxDim / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
};

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
      'image/jpeg',
      quality,
    );
  });

const drawToJpeg = (
  source: CanvasImageSource,
  target: ImageSize,
  quality: number,
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is unavailable in this browser.');
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return canvasToJpegBlob(canvas, quality);
};

/**
 * The fallback for non-JPEG input or a browser without createImageBitmap: the
 * old full-resolution decode. Still bounded by an object URL rather than a
 * Base64 copy, but it is the memory-hungry path and only runs when the cheap
 * one cannot.
 */
const downscaleViaImageElement = async (
  file: File,
  maxDim: number,
  quality: number,
): Promise<Blob> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The selected image could not be decoded.'));
      element.src = objectUrl;
    });
    const target = fitWithin({ width: img.naturalWidth, height: img.naturalHeight }, maxDim);
    return await drawToJpeg(img, target, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Reads only as much of the file as the header scan needs. 128 KiB clears the
 * EXIF block and any embedded thumbnail on every phone camera I know of; the
 * scan simply fails over to the fallback path if it somehow does not.
 */
const HEADER_BYTES = 128 * 1024;

export const fileToReceiptJpeg = async (
  file: File,
  maxDim = 1020,
  quality = 0.82,
): Promise<Blob> => {
  if (typeof createImageBitmap !== 'function') {
    return downscaleViaImageElement(file, maxDim, quality);
  }

  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const metadata = readJpegMetadata(header);
  if (!metadata) return downscaleViaImageElement(file, maxDim, quality);

  // createImageBitmap applies Exif before exposing the bitmap, so rotations
  // 5-8 need swapped target axes. Supplying the raw SOF shape here squeezes a
  // portrait capture into a landscape rectangle.
  const displayedSize = displayedSizeForOrientation(metadata, metadata.orientation);
  const target = fitWithin(displayedSize, maxDim);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
      imageOrientation: 'from-image',
    });
  } catch {
    // Some older engines expose createImageBitmap but reject one of its resize
    // options. Keep uploads working there via the bounded object-URL fallback.
    return downscaleViaImageElement(file, maxDim, quality);
  }
  try {
    // A browser may ignore decode-time resize hints. Cap the canvas again so a
    // compatibility quirk cannot create a huge JPEG that exceeds Storage's
    // five-megabyte receipt limit.
    const outputSize = fitWithin({ width: bitmap.width, height: bitmap.height }, maxDim);
    return await drawToJpeg(bitmap, outputSize, quality);
  } finally {
    // Frees the decoded pixels immediately instead of waiting for GC — the
    // whole point of this path on a memory-constrained WebView.
    bitmap.close();
  }
};
