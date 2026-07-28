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

/**
 * Reads the frame size out of a JPEG's SOF segment.
 *
 * Camera captures are always JPEG; anything else (PNG, WebP, HEIC) returns null
 * and the caller falls back to a plain decode. Returns pre-rotation dimensions
 * — EXIF orientation is applied later, during decode, and only ever swaps the
 * two axes, so the aspect ratio this drives stays correct either way.
 */
export const readJpegSize = (bytes: Uint8Array): ImageSize | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    // Segments are 0xFF followed by a marker; padding runs of 0xFF are legal.
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    // Standalone markers: no length field, nothing to skip.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;

    // SOF0/1/2/3, 5/6/7, 9/10/11, 13/14/15 all carry the frame size. 0xC4
    // (Huffman tables), 0xC8 and 0xCC are not frame headers despite the range.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += 2 + length;
  }
  return null;
};

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
  const size = readJpegSize(header);
  if (!size) return downscaleViaImageElement(file, maxDim, quality);

  const target = fitWithin(size, maxDim);
  // imageOrientation is what keeps a portrait receipt upright: drawImage on its
  // own ignores the EXIF rotation flag that phone cameras set.
  const bitmap = await createImageBitmap(file, {
    resizeWidth: target.width,
    resizeHeight: target.height,
    resizeQuality: 'high',
    imageOrientation: 'from-image',
  });
  try {
    // Orientation may have swapped the axes; follow the bitmap, not the header.
    return await drawToJpeg(bitmap, { width: bitmap.width, height: bitmap.height }, quality);
  } finally {
    // Frees the decoded pixels immediately instead of waiting for GC — the
    // whole point of this path on a memory-constrained WebView.
    bitmap.close();
  }
};
