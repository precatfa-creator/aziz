/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for the receipt storage/legacy split. The upload, signing and
 * download paths need a live Supabase project and the 0003 migration, so only
 * the pure classification is covered here. Run:
 * node --experimental-strip-types src/lib/receiptStorage.check.ts
 */

import assert from 'node:assert';
import {
  countInlineReceipts,
  isInlineReceipt,
  receiptEntries,
  receiptPath,
  rowsNeedingMigration,
} from './receiptImages.ts';

const UID = '11111111-2222-3333-4444-555555555555';
const inline = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const stored = `${UID}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`;

// The one predicate the render, export and backfill paths all branch on.
{
  assert.strictEqual(isInlineReceipt(inline), true);
  assert.strictEqual(isInlineReceipt(stored), false);
}

// Paths are owned by their first segment — the RLS policies in 0003 compare it
// against auth.uid(), so a wrong prefix means every upload is rejected.
{
  const path = receiptPath(UID);
  assert.strictEqual(path.split('/')[0], UID);
  assert.ok(path.endsWith('.jpg'));
  assert.notStrictEqual(receiptPath(UID), receiptPath(UID));
}

// Entry splitting tolerates the empty and undefined column.
{
  assert.deepStrictEqual(receiptEntries(undefined), []);
  assert.deepStrictEqual(receiptEntries(''), []);
  assert.deepStrictEqual(receiptEntries(`${stored}|${inline}`), [stored, inline]);
}

// Backfill selection: a row counts while any part is still inline, and a
// re-run over already-migrated rows must be a no-op.
{
  const rows = [
    { id: 'a', imageUrl: inline },
    { id: 'b', imageUrl: stored },
    { id: 'c', imageUrl: `${stored}|${inline}` },
    { id: 'd' },
  ];
  assert.deepStrictEqual(
    rowsNeedingMigration(rows).map((r) => r.id),
    ['a', 'c'],
  );
  assert.strictEqual(countInlineReceipts(rows), 2);

  const migrated = rows.map((r) => ({ ...r, imageUrl: r.imageUrl ? stored : undefined }));
  assert.deepStrictEqual(rowsNeedingMigration(migrated), []);
  assert.strictEqual(countInlineReceipts(migrated), 0);
}

console.log('receiptStorage.check.ts OK');
