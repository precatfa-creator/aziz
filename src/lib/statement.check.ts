/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for account statements. Run: npx tsx src/lib/statement.check.ts
 * Fixtures only — this never touches a real account.
 */

import assert from 'node:assert';
import { buildStatements } from './statement.ts';

const now = new Date('2026-01-01T00:00:00Z');
const card = { id: 'w1', userId: 'u', name: 'Card', initialBalance: 1000, currency: 'LYD', color: 'x', icon: 'x', createdAt: now, updatedAt: now } as any;
let seq = 0;
const inc = (date: string, amount: number, extra: object = {}) =>
  ({ id: `i${++seq}`, userId: 'u', amount, currency: 'LYD', title: `in ${amount}`, date, categoryId: 'c', walletId: 'w1', createdAt: new Date(now.getTime() + seq), updatedAt: now, ...extra }) as any;
const exp = (date: string, amount: number, extra: object = {}) =>
  ({ id: `e${++seq}`, userId: 'u', amount, currency: 'LYD', title: `out ${amount}`, date, categoryId: 'c', walletId: 'w1', createdAt: new Date(now.getTime() + seq), updatedAt: now, ...extra }) as any;

const incomes = [
  inc('2026-01-05', 500),
  inc('2026-02-03T10:15', 200),
  inc('2026-02-04', 50, { incomeKind: 'cash' }),
  inc('2026-02-05', 999, { isOpening: true }),
  inc('2026-02-06', 30, { transferId: 't1' }),
];
const expenses = [
  exp('2026-01-10', 100),
  exp('2026-02-07', 300, { expenseKind: 'cash_withdrawal' }),
  exp('2026-02-08', 120, { expenseKind: 'cash_spend' }),
  exp('2026-02-09', 40),
  exp('2026-02-10', 0, { isRefunded: true }),
  exp('2026-03-01', 70),
  exp('2026-02-11', 9, { walletId: '', externalSource: 'Gold' }),
];

// February on a card that has cash: two statements, each reconciling.
const feb = buildStatements(card, incomes, expenses, '2026-02-01', '2026-02-28');
assert.deepStrictEqual(feb.map((s) => s.compartment), ['card', 'cash']);
for (const s of feb) {
  assert.strictEqual(s.opening + s.totalIn - s.totalOut, s.closing, `${s.compartment} does not reconcile`);
  assert.strictEqual(s.rows.at(-1)!.balance, s.closing, `${s.compartment} running balance ends off the closing`);
}
const [cardSt, cashSt] = feb;
assert.strictEqual(cardSt.opening, 1000 + 500 - 100, 'opening = balance before the period');
assert.strictEqual(cardSt.closing, 1400 + 200 + 30 - 300 - 40);
assert.ok(!cardSt.rows.some((r) => r.amount === 999), 'an opening row is not a movement');
assert.ok(!cardSt.rows.some((r) => r.amount === 0), 'a refunded row moves nothing');
assert.ok(!cardSt.rows.some((r) => r.amount === 70), 'a row after the period leaked in');
assert.ok(![...cardSt.rows, ...cashSt.rows].some((r) => r.amount === 9), 'an outside-the-app part reached a wallet statement');
assert.strictEqual(cardSt.rows.find((r) => r.amount === 300)!.credit, false, 'a withdrawal leaves the card');
assert.strictEqual(cashSt.rows.find((r) => r.amount === 300)!.credit, true, 'a withdrawal arrives as cash');
assert.deepStrictEqual(cashSt.rows.map((r) => r.amount), [50, 300, 120]);
assert.strictEqual(cashSt.closing, 50 + 300 - 120);

// Hidden-details numbering: oldest first, transfers unnumbered.
assert.deepStrictEqual(cardSt.rows.map((r) => r.n), [1, undefined, 2, 3]);
assert.strictEqual(cardSt.rows.find((r) => r.isTransfer)!.amount, 30);

// A cash wallet is one statement holding everything, opening balance included.
const cashWallet = { ...card, isCard: false };
const all = buildStatements(cashWallet, incomes, expenses, '', '');
assert.deepStrictEqual(all.map((s) => s.compartment), ['cash']);
assert.strictEqual(all[0].opening, 1000, 'no start date: the opening is the initial balance');
assert.strictEqual(all[0].opening + all[0].totalIn - all[0].totalOut, all[0].closing);
assert.ok(!all[0].rows.some((r) => r.amount === 300), 'a withdrawal inside a cash wallet moves nothing');

// A card that never saw cash gets one statement.
assert.strictEqual(buildStatements(card, [inc('2026-01-01', 5)], [], '', '').length, 1);

// The opening balance is dated: by the wallet's opening entry when it has one,
// otherwise by when the wallet was created; with a start date, by that date.
assert.strictEqual(all[0].openingDate, '2026-02-05', 'opening dated by the opening entry');
assert.strictEqual(buildStatements(card, [], [exp('2026-01-02', 1)], '', '')[0].openingDate.length, 16, 'opening dated by wallet creation, to the minute');
assert.strictEqual(feb[0].openingDate, '2026-02-01');

console.log('statement.check.ts: all assertions passed');
