/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for the wallet compartment split and the multi-currency buckets.
 * Run: npx tsx src/lib/walletBalance.check.ts
 *
 * Fixtures only — this never touches a real account.
 */

import assert from 'node:assert';
import {
  convertAmount,
  inCompartment,
  isEarning,
  isSpending,
  roundMoney,
  walletBalance,
  walletCurrencies,
  walletTotals,
} from './walletBalance.ts';

const card = {
  id: 'w1',
  userId: 'u1',
  name: 'بطاقة 5 - 2026',
  initialBalance: 2500,
  currency: 'LYD',
  color: 'indigo',
  icon: 'CreditCard',
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const expense = (amount: number, expenseKind?: string, walletId = 'w1', extra: object = {}) =>
  ({
    id: `e${amount}${expenseKind ?? ''}${walletId}`,
    userId: 'u1',
    amount,
    currency: 'LYD',
    title: 'x',
    date: '2026-07-01',
    categoryId: 'c1',
    walletId,
    expenseKind,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  }) as any;

const income = (amount: number, extra: object = {}) =>
  ({
    id: `i${amount}${JSON.stringify(extra)}`,
    userId: 'u1',
    amount,
    currency: 'LYD',
    title: 'x',
    date: '2026-07-01',
    categoryId: 'c2',
    walletId: 'w1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  }) as any;

// The scenario: 2500 on the card, 2000 spent, the remaining 500 withdrawn as
// cash. The card is drained but the 500 is still owned.
{
  const b = walletBalance(card, [], [expense(2000), expense(500, 'cash_withdrawal')]);
  assert.strictEqual(b.onCard, 0);
  assert.strictEqual(b.inCash, 500);
  assert.strictEqual(b.total, 500);
  assert.strictEqual(b.cardConsumption, 2500, 'the card gave up all 2500');
  assert.strictEqual(b.actualSpending, 2000, 'a withdrawal is not spending');
}

// Spending 200 of that cash comes out of the cash compartment, not the card.
{
  const b = walletBalance(
    card,
    [],
    [expense(2000), expense(500, 'cash_withdrawal'), expense(200, 'cash_spend')],
  );
  assert.strictEqual(b.onCard, 0, 'the card is untouched by cash spending');
  assert.strictEqual(b.inCash, 300);
  assert.strictEqual(b.total, 300);
  assert.strictEqual(b.actualSpending, 2200);
  assert.strictEqual(b.cardConsumption, 2500, 'still 2500 — no new card outflow');
}

// Rows written before the migration have no kind and must behave exactly as
// they did: all spending, no cash compartment, same total as the old formula.
{
  const legacy = [expense(2000), expense(300)];
  const b = walletBalance(card, [], legacy);
  assert.strictEqual(b.onCard, 200);
  assert.strictEqual(b.inCash, 0);
  assert.strictEqual(b.total, 200);
  assert.strictEqual(b.total, 2500 - 2300, 'identical to initialBalance - Σexpenses');
  assert.strictEqual(b.cardConsumption, 2300);
}

// onCard + inCash is the definition of total, never an approximation of it —
// including when rows are mis-tagged as cash spending that was never withdrawn.
{
  const b = walletBalance(card, [], [expense(100, 'cash_spend')]);
  assert.strictEqual(b.inCash, -100);
  assert.strictEqual(b.total, b.onCard + b.inCash);
  assert.strictEqual(b.total, 2400, 'the money is still gone exactly once');
}

// Incomes land on the card. Opening rows restate the initial balance rather
// than adding to it, and another wallet's rows are not this wallet's business.
{
  const b = walletBalance(
    card,
    [income(400), income(9999, { isOpening: true }), income(50, { walletId: 'w2' })],
    [expense(1000), expense(7, undefined, 'w2')],
  );
  assert.strictEqual(b.totalIncomes, 400);
  assert.strictEqual(b.onCard, 2500 + 400 - 1000);
  assert.strictEqual(b.total, 1900);
}

// ---------------------------------------------------------------------------
// Currency exchange: one wallet, two buckets.
// ---------------------------------------------------------------------------

// The headline scenario. A 1000 LYD cash wallet, 912 LYD exchanged for 100 USD
// at 9.12. Nothing was earned and nothing was spent — the wallet now simply
// holds two currencies.
{
  const cash = { ...card, id: 'wc', initialBalance: 1000 } as any;
  const legs = {
    out: expense(912, undefined, 'wc', { transferId: 't1' }),
    in: income(100, { walletId: 'wc', currency: 'USD', transferId: 't1' }),
  };

  const lyd = walletBalance(cash, [legs.in], [legs.out]);
  assert.strictEqual(lyd.currency, 'LYD');
  assert.strictEqual(lyd.total, 88, '1000 - 912 stays in the LYD bucket');
  assert.strictEqual(lyd.actualSpending, 0, 'an exchange spends nothing');
  assert.strictEqual(lyd.transferOut, 912);
  assert.strictEqual(lyd.diff, 0, 'net flow must not move on an exchange');

  const usd = walletBalance(cash, [legs.in], [legs.out], 'USD');
  assert.strictEqual(usd.total, 100, 'the USD bucket opens at zero, not initialBalance');
  assert.strictEqual(usd.totalIncomes, 0, 'an exchange earns nothing');
  assert.strictEqual(usd.transferIn, 100);
  assert.strictEqual(usd.diff, 0);

  // The rate is derivable from the pair alone, which is why it is not stored.
  assert.strictEqual(lyd.transferOut / usd.transferIn, 9.12);

  assert.deepStrictEqual(walletCurrencies(cash, [legs.in], [legs.out]), ['LYD', 'USD']);
  assert.deepStrictEqual(
    walletTotals(cash, [legs.in], [legs.out]).map((b) => [b.currency, b.total]),
    [
      ['LYD', 88],
      ['USD', 100],
    ],
    'primary currency leads, so every card and picker orders the same way',
  );
}

// A wallet that has never touched a second currency must not grow one.
{
  assert.deepStrictEqual(walletCurrencies(card, [], [expense(10)]), ['LYD']);
}

// Spending the exchanged USD draws on the USD bucket and leaves LYD alone.
{
  const cash = { ...card, id: 'wc', initialBalance: 1000 } as any;
  const inLeg = income(100, { walletId: 'wc', currency: 'USD', transferId: 't1' });
  const outLeg = expense(912, undefined, 'wc', { transferId: 't1' });
  const usdSpend = expense(30, undefined, 'wc', { currency: 'USD' });

  assert.strictEqual(walletBalance(cash, [inLeg], [outLeg, usdSpend]).total, 88, 'LYD untouched');
  const usd = walletBalance(cash, [inLeg], [outLeg, usdSpend], 'USD');
  assert.strictEqual(usd.total, 70);
  assert.strictEqual(usd.actualSpending, 30, 'real spending, unlike the exchange leg');
}

// Exchanging out of cash in hand rather than off the card drains the right
// compartment — the two features have to compose, not collide.
{
  const cash = { ...card, id: 'wc', initialBalance: 1000 } as any;
  const b = walletBalance(
    cash,
    [],
    [expense(600, 'cash_withdrawal', 'wc'), expense(500, 'cash_spend', 'wc', { transferId: 't2' })],
  );
  assert.strictEqual(b.onCard, 400, 'the card only saw the withdrawal');
  assert.strictEqual(b.inCash, 100, '600 withdrawn, 500 exchanged away');
  assert.strictEqual(b.total, 500);
  assert.strictEqual(b.actualSpending, 0, 'withdrawing then exchanging spends nothing');
}

// A same-currency wallet-to-wallet transfer is the rate-1 case of the same
// mechanism: it must leave both wallets' spending and earning totals at zero.
{
  const to = { ...card, id: 'w2', initialBalance: 0 } as any;
  const out = expense(300, undefined, 'w1', { transferId: 't3' });
  const inc = income(300, { walletId: 'w2', transferId: 't3' });

  const from = walletBalance(card, [inc], [out]);
  const dest = walletBalance(to, [inc], [out]);
  assert.strictEqual(from.total, 2200);
  assert.strictEqual(dest.total, 300);
  assert.strictEqual(from.actualSpending, 0);
  assert.strictEqual(dest.totalIncomes, 0);
  assert.strictEqual(from.total + dest.total, 2500, 'a transfer conserves the money');
}

// Conversion, in both directions, at the rate the settings screen states.
// The exchange form derives its "to" amount from this, so a flipped division
// here would price every exchange wrong in one direction only.
{
  // Raw division does not land on 100 — 912 / 9.12 is 100.00000000000001 — which
  // is exactly why the stored leg is rounded rather than used as it comes out.
  assert.notStrictEqual(convertAmount(912, 'LYD', 'USD', 9.12), 100);
  assert.strictEqual(roundMoney(convertAmount(912, 'LYD', 'USD', 9.12)), 100);
  assert.strictEqual(roundMoney(convertAmount(100, 'USD', 'LYD', 9.12)), 912);
  assert.strictEqual(convertAmount(50, 'LYD', 'LYD', 9.12), 50, 'same currency is untouched');

  // The rate the history badge shows is derived back out of the stored pair, so
  // it has to reproduce the rate that was typed rather than drift off it.
  const stored = roundMoney(convertAmount(912, 'LYD', 'USD', 9.12));
  assert.strictEqual(Number((912 / stored).toFixed(2)), 9.12);
}

// The aggregate filters both screens rely on.
assert.strictEqual(isSpending(expense(500, 'cash_withdrawal')), false);
assert.strictEqual(isSpending(expense(500, 'cash_spend')), true);
assert.strictEqual(isSpending(expense(500)), true);
assert.strictEqual(isSpending(expense(500, undefined, 'w1', { transferId: 't1' })), false);
assert.strictEqual(
  isSpending(expense(500, 'cash_spend', 'w1', { transferId: 't1' })),
  false,
  'a transfer paid out of cash is still a transfer',
);

assert.strictEqual(isEarning(income(500)), true);
assert.strictEqual(isEarning(income(500, { isOpening: true })), false);
assert.strictEqual(isEarning(income(500, { transferId: 't1' })), false);

// Compartment filter: each list must reconcile to its own balance, so a
// withdrawal sits in both and incomes only ever land on the card.
assert.strictEqual(inCompartment(income(500), 'income', 'card'), true);
assert.strictEqual(inCompartment(income(500), 'income', 'cash'), false);
assert.strictEqual(inCompartment(expense(500), 'expense', 'card'), true, 'untagged rows are card spends');
assert.strictEqual(inCompartment(expense(500), 'expense', 'cash'), false);
assert.strictEqual(inCompartment(expense(500, 'cash_withdrawal'), 'expense', 'card'), true);
assert.strictEqual(inCompartment(expense(500, 'cash_withdrawal'), 'expense', 'cash'), true);
assert.strictEqual(inCompartment(expense(500, 'cash_spend'), 'expense', 'card'), false);
assert.strictEqual(inCompartment(expense(500, 'cash_spend'), 'expense', 'cash'), true);

// Wallet type. Existing wallets have no isCard and must compute exactly as
// before; a cash wallet keeps the same total with all of it in cash.
{
  const rows = [expense(400), expense(300, 'cash_withdrawal'), expense(100, 'cash_spend')];
  const legacy = walletBalance(card, [income(1000)], rows);
  const asCard = walletBalance({ ...card, isCard: true }, [income(1000)], rows);
  assert.deepStrictEqual(asCard, legacy, 'isCard: true must change nothing');
  assert.strictEqual(legacy.onCard, 2500 + 1000 - 400 - 300);
  assert.strictEqual(legacy.inCash, 200);

  const asCash = walletBalance({ ...card, isCard: false }, [income(1000)], rows);
  assert.strictEqual(asCash.total, legacy.total, 'switching type must not change the total');
  assert.strictEqual(asCash.onCard, 0);
  assert.strictEqual(asCash.inCash, legacy.total);
  assert.strictEqual(asCash.actualSpending, legacy.actualSpending);

  assert.strictEqual(inCompartment(expense(5), 'expense', 'cash', false), true);
  assert.strictEqual(inCompartment(income(5), 'income', 'card', false), false);
}

console.log('walletBalance.check.ts: all assertions passed');
