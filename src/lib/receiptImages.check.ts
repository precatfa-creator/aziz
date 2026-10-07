/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for receipt image packing. Run: node --experimental-strip-types
 * src/lib/receiptImages.check.ts
 */

import assert from 'node:assert';
import { IMAGE_COLUMN_LIMIT, packReceiptImages } from './receiptImages.ts';

const joinedLength = (kept: string[]) => kept.join('|').length;

// Everything fits: nothing is touched.
{
  const images = ['a'.repeat(10), 'b'.repeat(10)];
  const { kept, dropped } = packReceiptImages(images, 100);
  assert.deepStrictEqual(kept, images);
  assert.strictEqual(dropped, 0);
}

// The separators count. Three 10-char images need 32 chars, not 30.
{
  const images = ['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10)];
  assert.strictEqual(packReceiptImages(images, 31).dropped, 1);
  assert.strictEqual(packReceiptImages(images, 32).dropped, 0);
}

// Overflow drops the newest and keeps what was already attached.
{
  const images = ['a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)];
  const { kept, dropped } = packReceiptImages(images, 45);
  assert.deepStrictEqual(kept, [images[0], images[1]]);
  assert.strictEqual(dropped, 1);
  assert.ok(joinedLength(kept) <= 45);
}

// A single image larger than the column is dropped rather than truncated.
{
  const { kept, dropped } = packReceiptImages(['x'.repeat(200)], 100);
  assert.deepStrictEqual(kept, []);
  assert.strictEqual(dropped, 1);
}

// The real-world case: the 7-receipt row in the backup sits at 1,002,139 chars,
// so an eighth photo must be refused instead of failing the INSERT.
{
  const existing = Array.from({ length: 7 }, () => 'x'.repeat(143_161));
  assert.strictEqual(packReceiptImages(existing).dropped, 0);
  const { kept, dropped } = packReceiptImages([...existing, 'y'.repeat(150_000)]);
  assert.strictEqual(kept.length, 7);
  assert.strictEqual(dropped, 1);
  assert.ok(joinedLength(kept) <= IMAGE_COLUMN_LIMIT);
}

console.log('receiptImages.check.ts OK');
