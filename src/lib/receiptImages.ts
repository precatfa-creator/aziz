/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Everything about the image_url column that does not need Supabase — kept
 * import-free on purpose so it stays runnable under `node
 * --experimental-strip-types`, the same reason restoreBackup takes its client
 * as a parameter.
 *
 * A value is a "|"-joined list of entries, each either a Storage object path
 * (0003) or a legacy inline "data:image/..." Base64 receipt.
 */

/**
 * Must match `char_length(image_url) <= 1048576` in 0001_init.sql exactly —
 * legacy rows sit just under it, and a stricter number here would silently trim
 * them the next time they are edited.
 */
export const IMAGE_COLUMN_LIMIT = 1_048_576;

/** Splits a stored image_url into its entries, dropping the empty ones. */
export const receiptEntries = (imageUrl: string | undefined): string[] =>
  imageUrl ? imageUrl.split('|').filter(Boolean) : [];

/**
 * Legacy inline receipts. Everything that is not one of these is an object path
 * in the receipts bucket, so this single predicate decides the whole render,
 * export and backfill split.
 */
export const isInlineReceipt = (entry: string): boolean => entry.startsWith('data:');

/** Object paths are owned by their first segment — see the RLS policies in 0003. */
export const receiptPath = (userId: string, extension = 'jpg'): string =>
  `${userId}/${crypto.randomUUID()}.${extension}`;

/** Rows still holding at least one inline receipt. Everything else is done. */
export const rowsNeedingMigration = <T extends { imageUrl?: string }>(rows: T[]): T[] =>
  rows.filter((row) => receiptEntries(row.imageUrl).some(isInlineReceipt));

/** Counts the inline receipts across rows, for the "move N receipts" label. */
export const countInlineReceipts = (rows: { imageUrl?: string }[]): number =>
  rows.reduce((sum, row) => sum + receiptEntries(row.imageUrl).filter(isInlineReceipt).length, 0);

/**
 * Take as many images as fit the column, in order, and report the rest as
 * dropped. Overflowing the column makes the whole INSERT fail, which loses the
 * transaction — not just the photo — so the trimming has to happen before save.
 */
export const packReceiptImages = (
  images: string[],
  limit = IMAGE_COLUMN_LIMIT,
): { kept: string[]; dropped: number } => {
  const kept: string[] = [];
  let size = 0;

  for (const img of images) {
    const next = size + img.length + (kept.length ? 1 : 0); // +1 for the "|"
    if (next > limit) continue;
    kept.push(img);
    size = next;
  }

  return { kept, dropped: images.length - kept.length };
};
