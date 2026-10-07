/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure validation shared by the browser upload path and its Node self-check.
 * These values must stay aligned with 0003_receipts_storage.sql.
 */

export const RECEIPT_FILE_LIMIT_BYTES = 5 * 1024 * 1024;

const RECEIPT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Validates a receipt before network I/O and returns its normalized MIME type.
 * Canvas output is always JPEG; the other types keep legacy receipt migration
 * compatible with the bucket's allow-list.
 */
export const validateReceiptUpload = (blob: Blob): string => {
  if (blob.size === 0) {
    throw new Error('The receipt image is empty.');
  }
  if (blob.size > RECEIPT_FILE_LIMIT_BYTES) {
    throw new Error('The receipt image exceeds the 5 MiB storage limit.');
  }

  const rawType = blob.type.trim().toLowerCase();
  const contentType = rawType === '' || rawType === 'image/jpg' ? 'image/jpeg' : rawType;
  if (!RECEIPT_MIME_TYPES.has(contentType)) {
    throw new Error(`Unsupported receipt image type: ${rawType || 'unknown'}.`);
  }
  return contentType;
};
