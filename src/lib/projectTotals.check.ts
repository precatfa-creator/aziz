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
import { inRange, netSeries, projectFamily, projectTotals, shareTotals } from './projectTotals.ts';

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

// Project-only entries count for their own project (and its family), and
// mix currencies like linked rows.
{
  const projects = [
    { id: 'p1', entries: [
      { id: 'e1', kind: 'expense', amount: 100, currency: 'LYD' },
      { id: 'e2', kind: 'income', amount: 10, currency: 'USD' },
    ] },
    { id: 'p2', parentId: 'p1', entries: [{ id: 'e3', kind: 'expense', amount: 5, currency: 'USD' }] },
  ] as any;
  const own = projectTotals(new Set(['p1']), [row(1000)], [row(50)], 'LYD', 7, projects);
  assert.deepStrictEqual(own.spent, { LYD: 150, USD: 0 });
  assert.deepStrictEqual(own.earned, { LYD: 1000, USD: 10 });
  assert.strictEqual(own.net, 1070 - 150);
  const all = projectTotals(projectFamily(projects, 'p1'), [], [], 'LYD', 7, projects);
  assert.strictEqual(all.spentTotal, 100 + 35);
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

// Sharing: p1 shared, its child p2 not. Each row splits by its own project.
// Not-done expenses: partner owes half. Not-done incomes: user owes half.
// The two balances never net. A withdrawal creates no debt.
{
  const projects = [
    { id: 'p1', isShared: true, entries: [
      { id: 'e1', kind: 'expense', amount: 100, currency: 'USD' },
      { id: 'e2', kind: 'income', amount: 40, currency: 'LYD', settled: true },
    ] },
    { id: 'p2', parentId: 'p1', isShared: false, entries: [{ id: 'e3', kind: 'expense', amount: 70, currency: 'LYD' }] },
  ] as any;
  const expenses = [
    row(1000),
    row(600, { projectSettled: true }),
    row(400, { expenseKind: 'cash_withdrawal' }),
    row(80, { projectId: 'p2' }),
  ];
  const incomes = [row(300)];
  const own = shareTotals(new Set(['p1']), incomes, expenses, 'LYD', 7, projects);
  assert.strictEqual(own.anyShared, true);
  // spent 1000 + 600 + 700 (100 USD) = 2300 → half each
  assert.strictEqual(own.mySpent, 1150);
  assert.strictEqual(own.partnerSpent, 1150);
  assert.strictEqual(own.myEarned, 170, '(300 + 40) / 2');
  assert.strictEqual(own.myNet, 170 - 1150);
  assert.deepStrictEqual(own.owedToMe, { LYD: 500, USD: 50 }, 'settled 600 and the withdrawal owe nothing');
  assert.strictEqual(own.owedToMeTotal, 500 + 350);
  assert.deepStrictEqual(own.iOwe, { LYD: 150, USD: 0 }, 'settled 40 owes nothing');
  assert.strictEqual(own.iOweTotal, 150, 'kept apart from owedToMe');

  // With the unshared child: its 70 + 80 are all the user's, no debt.
  const all = shareTotals(projectFamily(projects, 'p1'), incomes, expenses, 'LYD', 7, projects);
  assert.strictEqual(all.mySpent, 1150 + 150);
  assert.strictEqual(all.partnerSpent, 1150);
  assert.strictEqual(all.owedToMeTotal, 850);

  // An unshared project alone: everything is the user's.
  const solo = shareTotals(new Set(['p2']), incomes, expenses, 'LYD', 7, projects);
  assert.strictEqual(solo.anyShared, false);
  assert.strictEqual(solo.mySpent, 150);
  assert.strictEqual(solo.owedToMeTotal, 0);
}

// Running net per day, sorted; the user's line halves shared rows only.
{
  const projects = [{ id: 'p1', isShared: true, entries: [] }] as any;
  const s = netSeries(
    new Set(['p1']),
    [row(500, { date: '2026-07-03' })],
    [row(1000, { date: '2026-07-02T10:00' }), row(200, { date: '2026-07-02' })],
    'LYD', 7, projects,
  );
  assert.deepStrictEqual(s, [
    { date: '2026-07-02', net: -1200, mine: -600 },
    { date: '2026-07-03', net: -700, mine: -350 },
  ]);
}

// Range: history before the cutoff still draws a flat line to today;
// the whole history starts from zero.
{
  const s = [{ date: '2026-01-10', net: -500, mine: -250 }, { date: '2026-02-01', net: -300, mine: -150 }];
  assert.deepStrictEqual(inRange(s, '1M', '2026-07-01'), [
    { date: '2026-06-01', net: -300, mine: -150 },
    { date: '2026-07-01', net: -300, mine: -150 },
  ]);
  const all = inRange(s, 'ALL', '2026-07-01');
  assert.deepStrictEqual(all[0], { date: '2026-01-10', net: 0, mine: 0 });
  assert.strictEqual(all.length, 4);
  assert.deepStrictEqual(inRange([], '1M'), []);
}

console.log('projectTotals: all checks passed');
