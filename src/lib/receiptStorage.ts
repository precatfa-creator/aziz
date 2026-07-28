/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Receipts live in the private "receipts" Storage bucket (0003), and
 * expenses.image_url / incomes.image_url hold a "|"-joined list of object
 * paths. Rows written before that migration hold "data:image/..." Base64
 * instead; both forms stay readable, and Settings can move the old ones over.
 *
 * ponytail: receipts now need the network to display, where inline Base64 did
 * not. Acceptable — the app already needs Supabase to show a single number —
 * but if offline receipt viewing is ever wanted, cache the signed URLs' blobs
 * in the service worker rather than going back to Base64 in the column.
 */

import { supabase } from '../supabase';
import { isInlineReceipt, receiptEntries, receiptPath } from './receiptImages';

export const RECEIPTS_BUCKET = 'receipts';

/** Signed URLs are short-lived by default; an hour outlives any form session. */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Renders the whole canvas to a JPEG blob. Deliberately not toDataURL: Base64
 * is a third larger and doubles peak memory, which matters on the phone that
 * just took the photo.
 */
export const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
      'image/jpeg',
      quality,
    );
  });

/** Uploads one receipt and returns the path to store in image_url. */
export const uploadReceipt = async (blob: Blob, userId: string): Promise<string> => {
  const path = receiptPath(userId);
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
  // upload() reports failure in the result rather than throwing. Swallowing it
  // would save a transaction pointing at an object that was never written.
  if (error) throw error;
  return path;
};

/**
 * Signs object paths in one batched call, keyed by path so a render can look
 * each one up. Callers pass only paths — inline Base64 entries are already
 * displayable and never come through here.
 */
export const resolveReceiptUrls = async (
  paths: string[],
): Promise<{ urls: Record<string, string>; missing: number }> => {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return { urls: {}, missing: 0 };

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const urls: Record<string, string> = {};
  for (const item of data || []) {
    if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
  }
  // createSignedUrls reports per-path failures inside the array rather than in
  // `error`. Reported separately so the caller can still show the receipts that
  // did sign, instead of leaving every tile loading forever.
  return { urls, missing: unique.length - Object.keys(urls).length };
};

/**
 * Inlines a receipt as Base64 so a backup stays self-contained — a JSON full of
 * object paths would be useless when restored into another account.
 */
export const receiptToDataUrl = async (entry: string): Promise<string> => {
  if (isInlineReceipt(entry)) return entry;

  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).download(entry);
  if (error) throw error;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Receipt ${entry} could not be read.`));
    reader.readAsDataURL(data);
  });
};

/**
 * Rewrites a set of rows with their receipts inlined, for the backup file.
 *
 * Throws on the first receipt that cannot be downloaded rather than returning a
 * partial set: a backup that silently omits what it claims to carry is worse
 * than no backup, which is the same rule buildBackup() states for collections.
 */
export const inlineReceiptsForBackup = async <T extends { imageUrl?: string }>(
  rows: T[],
): Promise<T[]> =>
  Promise.all(
    rows.map(async (row) => {
      const entries = receiptEntries(row.imageUrl);
      if (!entries.some((entry) => !isInlineReceipt(entry))) return row;
      const inlined = await Promise.all(entries.map(receiptToDataUrl));
      return { ...row, imageUrl: inlined.join('|') };
    }),
  );

/** Turns one inline Base64 receipt back into a blob for upload. */
export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return res.blob();
};
