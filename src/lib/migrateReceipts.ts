/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-time move of inline Base64 receipts into the Storage bucket from 0003.
 * Re-runnable on purpose: restoring an old backup re-inserts Base64 rows, so
 * this has to be something the user can simply run again rather than a
 * one-shot flag that refuses the second pass.
 */

import { supabase } from '../supabase';
import { isInlineReceipt, receiptEntries, rowsNeedingMigration } from './receiptImages';
import { dataUrlToBlob, uploadReceipt } from './receiptStorage';

export interface ReceiptRow {
  id: string;
  imageUrl?: string;
}

export interface MigrationResult {
  /** Rows whose receipts are now all Storage paths. */
  migrated: number;
  /** Rows left untouched because part of them failed — nothing was half-written. */
  failed: number;
  /** Inline receipts moved into the bucket. */
  receipts: number;
}

const migrateTable = async (
  table: 'incomes' | 'expenses',
  rows: ReceiptRow[],
  userId: string,
  result: MigrationResult,
): Promise<void> => {
  for (const row of rowsNeedingMigration(rows)) {
    try {
      // Upload every part first. A row is rewritten only once all of its
      // receipts exist in the bucket, so a failure halfway through leaves the
      // original Base64 in place instead of a row pointing at nothing.
      //
      // One at a time: a row can hold seven ~265 KB receipts, and decoding them
      // concurrently is the same mobile memory spike processFiles avoids. The
      // backfill runs once, so it can afford to be slow.
      const entries: string[] = [];
      for (const entry of receiptEntries(row.imageUrl)) {
        entries.push(
          isInlineReceipt(entry) ? await uploadReceipt(await dataUrlToBlob(entry), userId) : entry,
        );
      }

      const { error } = await supabase
        .from(table)
        .update({ image_url: entries.join('|') })
        .eq('id', row.id);
      if (error) throw error;

      result.migrated++;
      result.receipts += receiptEntries(row.imageUrl).filter(isInlineReceipt).length;
    } catch (e) {
      console.error(`Receipt migration failed for ${table}/${row.id}`, e);
      result.failed++;
    }
  }
};

export const migrateReceiptsToStorage = async (
  userId: string,
  incomes: ReceiptRow[],
  expenses: ReceiptRow[],
): Promise<MigrationResult> => {
  const result: MigrationResult = { migrated: 0, failed: 0, receipts: 0 };
  await migrateTable('incomes', incomes, userId, result);
  await migrateTable('expenses', expenses, userId, result);
  return result;
};
