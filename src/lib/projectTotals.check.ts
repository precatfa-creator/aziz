/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for project cost/return totals.
 * Run: npx tsx src/lib/projectTotals.check.ts
 *
 * Fixtures only — this never touches a real account.
 */

import assert from 'node:assert';
import { projectFamily, projectTotals } from './projectTotals.ts';

const row = (amount: number, extra: object = {}) =>
  ({ id: `r${amount}`, amount, currency: 'LYD', date: '2026-07-01', projectId: 'p1', ...extra }) as any;

// Goods 3000 LYD + shipping 200 USD + 500 paid in gold, 1000 back from sales.
// A withdrawal, a transfer leg, a refunded row (mapExpense reads it as 0) and
// another project's row must not move the totals.
{
  const expenses = [
    row(3000),
    row(200, { currency: 'USD' }),
    row(500, { externalSource: 'ذهب', walletId: '' }),
    row(400, { expenseKind: 'cash_withdrawal' }),
    row(700, { transferId: 't1' }),
    row(0, { isRefunded: true }),
    row(999, { projectId: 'p2' }),
    row(50, { projectId: undefined }),
  ];
  const incomes = [row(1000), row(300, { transferId: 't1' }), row(800, { isOpening: true })];
  const t = projectTotals(new Set(['p1']), incomes, expenses, 'LYD', 7);

  assert.deepStrictEqual(t.spent, { LYD: 3500, USD: 200 });
  assert.deepStrictEqual(t.earned, { LYD: 1000, USD: 0 });
  assert.strictEqual(t.spentTotal, 4900, '3500 + 200 × 7');
  assert.strictEqual(t.earnedTotal, 1000);
  assert.strictEqual(t.net, -3900);

  const usd = projectTotals(new Set(['p1']), incomes, expenses, 'USD', 7);

  // p2 under p1: the parent alone ignores it, the family adds its 999.
  const projects = [{ id: 'p1' }, { id: 'p2', parentId: 'p1' }] as any;
  const all = projectTotals(projectFamily(projects, 'p1'), incomes, expenses, 'LYD', 7);
  assert.strictEqual(all.spentTotal, 4900 + 999);
  assert.strictEqual(usd.spentTotal, 700, '3500 / 7 + 200');
}

// An empty project is all zeros, not NaN.
{
  const t = projectTotals(new Set(['p9']), [], [], 'LYD', 6.15);
  assert.strictEqual(t.spentTotal, 0);
  assert.strictEqual(t.net, 0);
}

// Grandchildren are included; a cycle terminates instead of looping forever.
{
  const projects = [
    { id: 'a' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }, { id: 'x' },
    { id: 'm', parentId: 'n' }, { id: 'n', parentId: 'm' },
  ] as any;
  assert.deepStrictEqual([...projectFamily(projects, 'a')].sort(), ['a', 'b', 'c']);
  assert.deepStrictEqual([...projectFamily(projects, 'm')].sort(), ['m', 'n']);
}

console.log('projectTotals: all checks passed');
