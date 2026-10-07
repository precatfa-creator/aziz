/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for the AI ledger trimming. Run: node --experimental-strip-types
 * src/lib/aiContext.check.ts
 */

import assert from 'node:assert';
import { buildLedgerContext } from './aiContext.ts';

const categories = [
  { id: 'c1', name: 'طعام / Food' },
  { id: 'c2', name: 'راتب / Salary' },
] as any;

const incomes = Array.from({ length: 3 }, (_, i) => ({
  id: `i${i}`,
  userId: 'u1',
  amount: 100 + i,
  currency: 'LYD',
  title: `Salary ${i}`,
  date: `2026-01-0${i + 1}`,
  categoryId: 'c2',
  createdAt: new Date(),
  updatedAt: new Date(),
  imageUrl: 'https://example.com/x.png',
})) as any;

const expenses = Array.from({ length: 5 }, (_, i) => ({
  id: `e${i}`,
  userId: 'u1',
  amount: 10 + i,
  currency: 'LYD',
  title: `Lunch ${i}`,
  date: `2026-02-0${i + 1}`,
  categoryId: 'c1',
  notes: 'n',
  createdAt: new Date(),
  updatedAt: new Date(),
})) as any;

// Cap is honoured, and reports the untruncated total so the prompt can say so.
const capped = buildLedgerContext(incomes, expenses, categories, 'ar', 4);
assert.equal(capped.rows.length, 4);
assert.equal(capped.shown, 4);
assert.equal(capped.total, 8);

// Newest first — the cap must keep recent rows, not arbitrary ones.
assert.equal(capped.rows[0].date, '2026-02-05');
assert.deepEqual(
  capped.rows.map((r) => r.date),
  ['2026-02-05', '2026-02-04', '2026-02-03', '2026-02-02'],
);

// No internals leak into the payload.
for (const row of capped.rows) {
  for (const banned of ['id', 'userId', 'createdAt', 'updatedAt', 'imageUrl', 'categoryId']) {
    assert.ok(!(banned in row), `${banned} leaked into the AI payload`);
  }
  assert.ok(row.title && row.date && typeof row.amount === 'number');
}

// Category ids resolve to the language-appropriate half of "ar / en".
assert.equal(capped.rows[0].category, 'طعام');
assert.equal(buildLedgerContext([], expenses, categories, 'en', 1).rows[0].category, 'Food');

// Under the cap, nothing is dropped and totals agree.
const full = buildLedgerContext(incomes, expenses, categories, 'ar');
assert.equal(full.rows.length, 8);
assert.equal(full.shown, full.total);

// Empty ledger is a valid state, not a crash.
const empty = buildLedgerContext([], [], categories, 'ar');
assert.deepEqual(empty, { rows: [], shown: 0, total: 0 });

console.log('aiContext: all checks passed');
